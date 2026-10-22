"use server";

import { revalidatePath } from "next/cache";
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
  setRfqStatus,
} from "@/lib/rfq-repo";
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

  const id = crypto.randomUUID();
  try {
    const db = await getRequestDb();
    await insertRfq(db, { ...parsed.value, id, ownerId: user.id });
    try {
      await storeUploads(db, uploads.uploads, { rfqId: id, quoteId: null, uploaderId: user.id });
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
