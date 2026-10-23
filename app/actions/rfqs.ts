"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import {
  checkAttachmentSet,
  MAX_QUOTE_ATTACHMENTS,
  MAX_RFQ_ATTACHMENTS,
  type CheckedAttachment,
} from "@/lib/attachments";
import { DatabaseConfigError } from "@/lib/db";
import { deletePrivateFile, filesUnavailableReason, putPrivateFile } from "@/lib/file-store";
import { readValues, type FormState } from "@/lib/form-state";
import { isSafeId } from "@/lib/paths";
import { acceptsQuotes, parseQuoteForm, parseRfqForm } from "@/lib/rfq";
import {
  canMessageAboutRfq,
  decideQuote,
  findQuoteByQuoter,
  getRfqById,
  insertQuote,
  insertRfq,
  insertRfqFile,
  insertRfqMessage,
  listActiveQuoterIds,
  listRfqFiles,
  reviseRfq,
  setRfqStatus,
  withdrawQuote,
  type RfqFileOp,
} from "@/lib/rfq-repo";
import { diffRfq, revLabel, summarizeChanges } from "@/lib/rfq-history";
import { DEFAULT_NDA_MODE, NDA_MODE_LABELS, parseNdaMode, parseSignature, type NdaMode } from "@/lib/nda";
import { listSignerIds, mustSignNda, recordNdaSignature } from "@/lib/nda-repo";
import { getRequestDb } from "@/lib/server-db";
import { getCurrentUser } from "@/lib/session";
import { parseMessageBody } from "@/lib/validation";
import { lookupZip } from "@/lib/zip";
import type { Client } from "@libsql/client";

const RFQ_FIELDS = [
  "title",
  "category",
  "subtype",
  "quantity",
  "unit",
  "specs",
  "neededBy",
  "deliveryZip",
  "deliveryLocation",
  "budget",
  "expiresOn",
];
const QUOTE_FIELDS = ["price", "priceBasis", "quantity", "leadTimeDays", "notes", "validUntil"];

const PROFILE_REQUIRED =
  "Finish your company profile (business type, city, state, and contact) on the Account page first.";

type Upload = { file: File; bytes: Uint8Array; checked: CheckedAttachment };

async function readUploads(
  formData: FormData,
  max: number,
): Promise<{ ok: true; uploads: Upload[] } | { ok: false; error: string }> {
  const files = formData
    .getAll("attachments")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
  return checkFiles(files, max);
}

async function checkFiles(
  files: File[],
  max: number,
): Promise<{ ok: true; uploads: Upload[] } | { ok: false; error: string }> {
  if (files.length === 0) return { ok: true, uploads: [] };
  const unavailable = filesUnavailableReason();
  if (unavailable) return { ok: false, error: unavailable };
  const loaded = await Promise.all(
    files.map(async (file) => ({ file, bytes: new Uint8Array(await file.arrayBuffer()) })),
  );
  const checked = checkAttachmentSet(
    loaded.map(({ file, bytes }) => ({ name: file.name, size: file.size, head: bytes.slice(0, 16) })),
    max,
  );
  if (!checked.ok) return checked;
  return {
    ok: true,
    uploads: loaded.map((item, index) => ({ ...item, checked: checked.value[index] })),
  };
}

async function storeUploads(
  db: Client,
  uploads: Upload[],
  ids: { rfqId: string; quoteId: string | null; uploaderId: string },
): Promise<string[]> {
  const stored: string[] = [];
  try {
    for (const upload of uploads) {
      const id = crypto.randomUUID();
      const pathname = `rfq/${ids.rfqId}/${id}-${upload.checked.name}`;
      await putPrivateFile(pathname, upload.bytes, upload.checked.contentType);
      stored.push(pathname);
      await insertRfqFile(db, {
        id,
        rfqId: ids.rfqId,
        quoteId: ids.quoteId,
        uploaderId: ids.uploaderId,
        name: upload.checked.name,
        pathname,
        contentType: upload.checked.contentType,
        size: upload.checked.size,
      });
    }
  } catch (error) {
    await Promise.all(stored.map((pathname) => deletePrivateFile(pathname)));
    throw error;
  }
  return stored;
}

export async function createRfqAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = readValues(formData, RFQ_FIELDS);
  const user = await getCurrentUser();
  if (!user) return { errors: {}, values, formError: "Sign in with your business account to post an RFQ." };
  if (!user.profileComplete) return { errors: {}, values, formError: PROFILE_REQUIRED };
  if (formData.get("acknowledge") !== "on") {
    return {
      errors: { acknowledge: "Confirm the attachment warning before posting." },
      values,
    };
  }

  const parsed = parseRfqForm(values, (zip) => lookupZip(zip) != null);
  if (!parsed.ok) return { errors: parsed.errors, values };
  const uploads = await readUploads(formData, MAX_RFQ_ATTACHMENTS);
  if (!uploads.ok) return { errors: { attachments: uploads.error }, values };
  const ndaMode = parseNdaMode(stringField(formData, "ndaMode")) ?? DEFAULT_NDA_MODE;
  values.ndaMode = ndaMode;
  const ndaUpload = await readNdaUpload(formData);
  if (!ndaUpload.ok) return { errors: { ndaFile: ndaUpload.error }, values };
  if (ndaMode === "custom" && !ndaUpload.upload) {
    return { errors: { ndaFile: "Upload your NDA as a PDF, or pick the Skrappily standard NDA." }, values };
  }

  const id = crypto.randomUUID();
  try {
    const db = await getRequestDb();
    await insertRfq(db, { ...parsed.value, id, ownerId: user.id, ndaMode });
    try {
      await storeUploads(db, uploads.uploads, { rfqId: id, quoteId: null, uploaderId: user.id });
      if (ndaMode === "custom" && ndaUpload.upload) {
        const ndaFile = await storeNdaUpload(ndaUpload.upload, id, user.id);
        await insertRfqFile(db, { ...ndaFile, kind: "nda" });
        await db.execute({ sql: "UPDATE rfqs SET nda_file_id = ? WHERE id = ?", args: [ndaFile.id, id] });
      }
    } catch {
      await db.batch(
        [
          { sql: "DELETE FROM rfq_files WHERE rfq_id = ?", args: [id] },
          { sql: "DELETE FROM rfqs WHERE id = ?", args: [id] },
        ],
        "write",
      );
      return { errors: {}, values, formError: "The attachments couldn't be stored. Try again." };
    }
  } catch (error) {
    if (error instanceof DatabaseConfigError) return { errors: {}, values, formError: error.message };
    throw error;
  }
  revalidatePath("/rfqs");
  revalidatePath("/account");
  redirect(`/rfqs/${id}`);
}

export async function submitQuoteAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = readValues(formData, QUOTE_FIELDS);
  const rfqId = stringField(formData, "rfqId");
  const user = await getCurrentUser();
  if (!user) return { errors: {}, values, formError: "Sign in with your business account to quote." };
  if (!user.profileComplete) return { errors: {}, values, formError: PROFILE_REQUIRED };
  if (!isSafeId(rfqId)) return { errors: {}, values, formError: "That RFQ isn't available." };

  const parsed = parseQuoteForm(values);
  if (!parsed.ok) return { errors: parsed.errors, values };
  const uploads = await readUploads(formData, MAX_QUOTE_ATTACHMENTS);
  if (!uploads.ok) return { errors: { attachments: uploads.error }, values };

  const db = await getRequestDb();
  const rfq = await getRfqById(db, rfqId);
  if (!rfq) return { errors: {}, values, formError: "That RFQ isn't available." };
  if (rfq.ownerId === user.id) return { errors: {}, values, formError: "You can't quote your own RFQ." };
  if (!acceptsQuotes(rfq)) return { errors: {}, values, formError: "This RFQ is no longer taking quotes." };
  if (await mustSignNda(db, rfq, user.id)) {
    return { errors: {}, values, formError: "Sign this RFQ's NDA before you quote." };
  }
  if (await findQuoteByQuoter(db, rfqId, user.id)) {
    return { errors: {}, values, formError: "Your company already quoted this RFQ." };
  }

  const quoteId = crypto.randomUUID();
  await insertQuote(db, { ...parsed.value, id: quoteId, rfqId, quoterId: user.id });
  try {
    await storeUploads(db, uploads.uploads, { rfqId, quoteId, uploaderId: user.id });
  } catch {
    await db.batch(
      [
        { sql: "DELETE FROM rfq_files WHERE quote_id = ?", args: [quoteId] },
        { sql: "DELETE FROM rfq_quotes WHERE id = ?", args: [quoteId] },
      ],
      "write",
    );
    return { errors: {}, values, formError: "The attachment couldn't be stored. Try again." };
  }
  revalidatePath(`/rfqs/${rfqId}`);
  revalidatePath("/rfqs");
  return { errors: {}, values: {}, success: "Quote sent. The buyer will see it on the RFQ." };
}

export async function decideQuoteAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  const rfqId = stringField(formData, "rfqId");
  const quoteId = stringField(formData, "quoteId");
  const decision = stringField(formData, "decision");
  if (!user) redirect(`/login?next=/rfqs/${rfqId}`);
  if (!isSafeId(rfqId) || !isSafeId(quoteId) || (decision !== "accepted" && decision !== "declined")) {
    notFound();
  }
  const db = await getRequestDb();
  await decideQuote(db, rfqId, user.id, quoteId, decision);
  revalidatePath(`/rfqs/${rfqId}`);
  revalidatePath("/rfqs");
}

export async function closeRfqAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  const rfqId = stringField(formData, "rfqId");
  if (!user) redirect(`/login?next=/rfqs/${rfqId}`);
  if (!isSafeId(rfqId)) notFound();
  const db = await getRequestDb();
  const rfq = await getRfqById(db, rfqId);
  if (!rfq || rfq.ownerId !== user.id) notFound();
  if (rfq.status === "open") await setRfqStatus(db, rfqId, user.id, "closed");
  revalidatePath(`/rfqs/${rfqId}`);
  revalidatePath("/rfqs");
}

export async function sendRfqMessageAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const rfqId = stringField(formData, "rfqId");
  const recipientId = stringField(formData, "recipientId");
  const values = { body: stringField(formData, "body") };
  const user = await getCurrentUser();
  if (!user) return { errors: {}, values, formError: "Sign in with your business account to message." };
  if (!user.profileComplete) return { errors: {}, values, formError: PROFILE_REQUIRED };
  if (!isSafeId(rfqId) || !isSafeId(recipientId)) {
    return { errors: {}, values, formError: "That conversation isn't available." };
  }
  const parsed = parseMessageBody(values.body);
  if (!parsed.ok) return { errors: { body: parsed.error }, values };

  const db = await getRequestDb();
  const rfq = await getRfqById(db, rfqId);
  if (!rfq || !(await canMessageAboutRfq(db, rfq, user.id, recipientId))) {
    return { errors: {}, values, formError: "You can't message this business about this RFQ." };
  }
  await insertRfqMessage(db, {
    id: crypto.randomUUID(),
    rfqId,
    senderId: user.id,
    recipientId,
    body: parsed.body,
  });
  revalidatePath("/inbox");
  revalidatePath(`/inbox/rfq/${rfqId}/${recipientId}`);
  redirect(`/inbox/rfq/${rfqId}/${recipientId}`);
}

function stringField(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/** Owner edit: every change becomes a new revision with a change log. */
export async function updateRfqAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = readValues(formData, RFQ_FIELDS);
  const rfqId = stringField(formData, "rfqId");
  const user = await getCurrentUser();
  if (!user) return { errors: {}, values, formError: "Sign in with your business account." };
  if (!isSafeId(rfqId)) return { errors: {}, values, formError: "That RFQ isn't available." };
  const db = await getRequestDb();
  const rfq = await getRfqById(db, rfqId);
  if (!rfq || rfq.ownerId !== user.id) return { errors: {}, values, formError: "Only the RFQ owner can edit it." };
  if (rfq.status !== "open") return { errors: {}, values, formError: "Awarded or closed RFQs can't be edited." };

  const parsed = parseRfqForm(values, (zip) => lookupZip(zip) != null);
  if (!parsed.ok) return { errors: parsed.errors, values };
  const changes = diffRfq(rfq, parsed.value);

  const ndaMode = parseNdaMode(stringField(formData, "ndaMode")) ?? rfq.ndaMode;
  values.ndaMode = ndaMode;
  const ndaUpload = await readNdaUpload(formData);
  if (!ndaUpload.ok) return { errors: { ndaFile: ndaUpload.error }, values };
  const newNdaPdf = ndaMode === "custom" ? ndaUpload.upload : null;
  if (ndaMode === "custom" && !newNdaPdf && !rfq.ndaFileId) {
    return { errors: { ndaFile: "Upload your NDA as a PDF, or pick the Skrappily standard NDA." }, values };
  }
  const ndaChanged = ndaMode !== rfq.ndaMode || Boolean(newNdaPdf);

  const current = (await listRfqFiles(db, rfqId)).filter((f) => !f.quoteId && !f.removedAt);
  const removeIds = new Set(formData.getAll("removeFile").map(String));
  const replacements: { fileId: string; name: string; file: File }[] = [];
  for (const file of current) {
    const entry = formData.get(`replace-${file.id}`);
    if (entry instanceof File && entry.size > 0 && !removeIds.has(file.id)) {
      replacements.push({ fileId: file.id, name: file.name, file: entry });
    }
  }
  const added = formData
    .getAll("attachments")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
  const removed = current.filter((f) => removeIds.has(f.id));
  const remaining = current.length - removed.length;
  if (remaining + added.length > MAX_RFQ_ATTACHMENTS) {
    return { errors: { attachments: `Keep it to ${MAX_RFQ_ATTACHMENTS} current files. Remove one first.` }, values };
  }
  const newFiles = [...replacements.map((r) => r.file), ...added];
  if (newFiles.length > 0 && formData.get("acknowledge") !== "on") {
    return { errors: { acknowledge: "Confirm the attachment warning before uploading." }, values };
  }
  const checked = await checkFiles(newFiles, MAX_RFQ_ATTACHMENTS);
  if (!checked.ok) return { errors: { attachments: checked.error }, values };

  const stored: string[] = [];
  const ops: RfqFileOp[] = removed.map((f) => ({ kind: "remove" as const, fileId: f.id, name: f.name }));
  try {
    for (const [index, upload] of checked.uploads.entries()) {
      const id = crypto.randomUUID();
      const pathname = `rfq/${rfqId}/${id}-${upload.checked.name}`;
      await putPrivateFile(pathname, upload.bytes, upload.checked.contentType);
      stored.push(pathname);
      const replacing = index < replacements.length ? replacements[index] : null;
      ops.push({
        kind: "add",
        file: {
          id,
          rfqId,
          quoteId: null,
          uploaderId: user.id,
          name: upload.checked.name,
          pathname,
          contentType: upload.checked.contentType,
          size: upload.checked.size,
        },
        replacesFileId: replacing?.fileId,
        replacedName: replacing?.name,
      });
    }
  } catch {
    await Promise.all(stored.map((pathname) => deletePrivateFile(pathname)));
    return { errors: {}, values, formError: "The attachments couldn't be stored. Try again." };
  }

  let nda: { mode: NdaMode; file?: Awaited<ReturnType<typeof storeNdaUpload>> } | undefined;
  if (ndaChanged) {
    try {
      nda = { mode: ndaMode, file: newNdaPdf ? await storeNdaUpload(newNdaPdf, rfqId, user.id) : undefined };
    } catch {
      await Promise.all(stored.map((pathname) => deletePrivateFile(pathname)));
      return { errors: {}, values, formError: "The NDA couldn't be stored. Try again." };
    }
  }
  const revision = await reviseRfq(db, { rfqId, ownerId: user.id, next: parsed.value, changes, fileOps: ops, nda });
  if (revision == null) return { errors: {}, values, formError: "Nothing changed." };

  const fileNotes = ops.map((op) =>
    op.kind === "remove" ? "drawing removed" : op.replacesFileId ? "drawing replaced" : "drawing added",
  );
  const summary = [summarizeChanges(changes), ...new Set(fileNotes), nda ? "NDA changed" : ""].filter(Boolean).join(", ");
  const quoters = await listActiveQuoterIds(db, rfqId);
  for (const quoterId of quoters) {
    await insertRfqMessage(db, {
      id: crypto.randomUUID(),
      rfqId,
      senderId: user.id,
      recipientId: quoterId,
      body: `RFQ updated to ${revLabel(revision)} (${summary}). Your quote was based on an earlier revision. Please re-check the RFQ and its History before you ship or re-confirm price and lead time.`,
    });
  }
  if (nda && nda.mode !== "none") {
    // Signers of an earlier NDA revision must re-sign before files unlock again.
    const quoterSet = new Set(quoters);
    for (const signerId of await listSignerIds(db, rfqId)) {
      if (quoterSet.has(signerId)) continue;
      await insertRfqMessage(db, {
        id: crypto.randomUUID(),
        rfqId,
        senderId: user.id,
        recipientId: signerId,
        body: `The NDA on this RFQ changed (${NDA_MODE_LABELS[nda.mode]}, ${revLabel(revision)}). Please review and re-sign it to keep access to the drawings.`,
      });
    }
  }
  revalidatePath(`/rfqs/${rfqId}`);
  revalidatePath("/rfqs");
  revalidatePath("/inbox");
  redirect(`/rfqs/${rfqId}?updated=1`);
}

export async function withdrawQuoteAction(formData: FormData): Promise<void> {
  const quoteId = stringField(formData, "quoteId");
  const back = stringField(formData, "back") === "rfq" ? `/rfqs/${stringField(formData, "rfqId")}` : "/quotes";
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/quotes");
  if (!isSafeId(quoteId)) notFound();
  const db = await getRequestDb();
  await withdrawQuote(db, quoteId, user.id);
  revalidatePath("/quotes");
  redirect(back.startsWith("/rfqs/") && !isSafeId(back.slice(6)) ? "/quotes" : back);
}

async function readNdaUpload(
  formData: FormData,
): Promise<{ ok: true; upload: Upload | null } | { ok: false; error: string }> {
  const entry = formData.get("ndaFile");
  if (!(entry instanceof File) || entry.size === 0) return { ok: true, upload: null };
  const checked = await checkFiles([entry], 1);
  if (!checked.ok) return checked;
  const upload = checked.uploads[0];
  if (upload.checked.contentType !== "application/pdf") return { ok: false, error: "The NDA has to be a PDF." };
  return { ok: true, upload };
}

async function storeNdaUpload(upload: Upload, rfqId: string, uploaderId: string) {
  const id = crypto.randomUUID();
  const pathname = `rfq/${rfqId}/nda/${id}-${upload.checked.name}`;
  await putPrivateFile(pathname, upload.bytes, upload.checked.contentType);
  return {
    id,
    rfqId,
    quoteId: null,
    uploaderId,
    name: upload.checked.name,
    pathname,
    contentType: upload.checked.contentType,
    size: upload.checked.size,
  };
}

/** Quoter e-signs the RFQ's current NDA revision. */
export async function signNdaAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const rfqId = stringField(formData, "rfqId");
  const values = { signerName: stringField(formData, "signerName"), signerTitle: stringField(formData, "signerTitle") };
  const user = await getCurrentUser();
  if (!user) return { errors: {}, values, formError: "Sign in with your business account to sign." };
  if (!user.profileComplete) return { errors: {}, values, formError: PROFILE_REQUIRED };
  if (!isSafeId(rfqId)) return { errors: {}, values, formError: "That RFQ isn't available." };
  const parsed = parseSignature({ ...values, agree: stringField(formData, "agree") || null });
  if (!parsed.ok) return { errors: parsed.errors, values };
  const db = await getRequestDb();
  const rfq = await getRfqById(db, rfqId);
  if (!rfq || rfq.ndaMode === "none") return { errors: {}, values, formError: "This RFQ doesn't have an NDA." };
  if (rfq.ownerId === user.id) return { errors: {}, values, formError: "You posted this RFQ, so there's nothing to sign." };
  // The form carries the revision it showed; refuse if the NDA changed underneath.
  if (Number(stringField(formData, "ndaRevision")) !== rfq.ndaRevision) {
    return { errors: {}, values, formError: "The buyer just updated the NDA. Review the new version and sign again." };
  }
  if (!(await mustSignNda(db, rfq, user.id))) redirect(`/rfqs/${rfqId}`);
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "";
  const sig = await recordNdaSignature(db, {
    rfq,
    signerId: user.id,
    signerName: parsed.value.signerName,
    signerTitle: parsed.value.signerTitle,
    ip,
    userAgent: h.get("user-agent") ?? "",
  });
  if (sig) {
    await insertRfqMessage(db, {
      id: crypto.randomUUID(),
      rfqId,
      senderId: user.id,
      recipientId: rfq.ownerId,
      body: `${sig.signerName} (${sig.signerTitle}) signed the NDA for this RFQ on behalf of ${sig.businessName}. Signed record: /rfqs/${rfqId}/nda/record/${sig.id}`,
    });
  }
  revalidatePath(`/rfqs/${rfqId}`);
  revalidatePath("/inbox");
  redirect(`/rfqs/${rfqId}?signed=1`);
}
