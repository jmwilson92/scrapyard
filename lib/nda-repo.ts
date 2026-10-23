import { createHash } from "node:crypto";
import type { Client } from "@libsql/client";
import {
  canAccessFile,
  formatNdaDate,
  NDA_TEMPLATE_VERSION,
  ndaTemplateText,
  needsNdaSignature,
  type NdaMode,
} from "@/lib/nda";
import type { Rfq, RfqFile } from "@/lib/rfq-repo";

export type NdaSignature = {
  id: string;
  rfqId: string;
  ndaRevision: number;
  ndaHash: string;
  ndaMode: NdaMode;
  ndaText: string;
  ndaFileId: string | null;
  signerId: string;
  companyId: string | null;
  businessName: string;
  signerName: string;
  signerTitle: string;
  ip: string;
  userAgent: string;
  signedAt: number;
};

type GateRfq = Pick<Rfq, "id" | "ownerId" | "ndaMode" | "ndaRevision">;

export async function signedNdaRevisions(db: Client, rfqId: string, signerId: string): Promise<number[]> {
  const result = await db.execute({
    sql: "SELECT DISTINCT nda_revision FROM rfq_nda_signatures WHERE rfq_id = ? AND signer_id = ?",
    args: [rfqId, signerId],
  });
  return result.rows.map((row) => Number(row.nda_revision));
}

export async function mustSignNda(db: Client, rfq: GateRfq, viewerId: string): Promise<boolean> {
  if (rfq.ndaMode === "none" || viewerId === rfq.ownerId) return false;
  return needsNdaSignature(rfq, viewerId, await signedNdaRevisions(db, rfq.id, viewerId));
}

/** Server-side gate used by the file route. */
export async function canDownloadRfqFile(
  db: Client,
  file: Pick<RfqFile, "quoteId" | "uploaderId" | "kind">,
  viewerId: string,
  rfq: GateRfq,
): Promise<boolean> {
  const signed = rfq.ndaMode === "none" ? [] : await signedNdaRevisions(db, rfq.id, viewerId);
  return canAccessFile(file, viewerId, rfq, signed);
}

export async function businessNameFor(db: Client, userId: string): Promise<{ name: string; companyId: string | null }> {
  const result = await db.execute({
    sql: `SELECT COALESCE(c.name, u.shop_name) AS name, u.company_id FROM users u
      LEFT JOIN companies c ON c.id = u.company_id WHERE u.id = ?`,
    args: [userId],
  });
  const row = result.rows[0];
  return { name: row ? String(row.name ?? "") : "", companyId: row?.company_id ? String(row.company_id) : null };
}

/** The exact NDA text a given quoter sees (template only). */
export function renderTemplateFor(rfq: Pick<Rfq, "id" | "title" | "companyName">, quoterName: string, at: number): string {
  return ndaTemplateText({
    buyerName: rfq.companyName,
    quoterName,
    rfqTitle: rfq.title,
    rfqId: rfq.id,
    date: formatNdaDate(at),
  });
}

/** Template as it reads if signed right now. */
export function renderTemplateNow(rfq: Pick<Rfq, "id" | "title" | "companyName">, quoterName: string): string {
  return renderTemplateFor(rfq, quoterName, Date.now());
}

export async function recordNdaSignature(
  db: Client,
  args: {
    rfq: Pick<Rfq, "id" | "title" | "companyName" | "ownerId" | "ndaMode" | "ndaRevision" | "ndaFileId">;
    signerId: string;
    signerName: string;
    signerTitle: string;
    ip: string;
    userAgent: string;
    at?: number;
  },
): Promise<NdaSignature | null> {
  const { rfq } = args;
  if (rfq.ndaMode === "none" || args.signerId === rfq.ownerId) return null;
  const at = args.at ?? Date.now();
  const business = await businessNameFor(db, args.signerId);
  const text = rfq.ndaMode === "template" ? renderTemplateFor(rfq, business.name, at) : "";
  const sig: NdaSignature = {
    id: crypto.randomUUID(),
    rfqId: rfq.id,
    ndaRevision: rfq.ndaRevision,
    ndaHash: ndaHash({ mode: rfq.ndaMode, text, fileId: rfq.ndaFileId, revision: rfq.ndaRevision }),
    ndaMode: rfq.ndaMode,
    ndaText: text,
    ndaFileId: rfq.ndaMode === "custom" ? rfq.ndaFileId : null,
    signerId: args.signerId,
    companyId: business.companyId,
    businessName: business.name,
    signerName: args.signerName,
    signerTitle: args.signerTitle,
    ip: args.ip.slice(0, 100),
    userAgent: args.userAgent.slice(0, 400),
    signedAt: at,
  };
  await db.execute({
    sql: `INSERT INTO rfq_nda_signatures (id, rfq_id, nda_revision, nda_hash, nda_mode, nda_text, nda_file_id, signer_id,
        company_id, business_name, signer_name, signer_title, ip, user_agent, signed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [sig.id, sig.rfqId, sig.ndaRevision, sig.ndaHash, sig.ndaMode, sig.ndaText, sig.ndaFileId, sig.signerId,
      sig.companyId, sig.businessName, sig.signerName, sig.signerTitle, sig.ip, sig.userAgent, sig.signedAt],
  });
  return sig;
}

export async function listNdaSignatures(db: Client, rfqId: string): Promise<NdaSignature[]> {
  const result = await db.execute({
    sql: "SELECT * FROM rfq_nda_signatures WHERE rfq_id = ? ORDER BY signed_at DESC",
    args: [rfqId],
  });
  return result.rows.map(mapSignature);
}

export async function listSignaturesBySigner(db: Client, rfqId: string, signerId: string): Promise<NdaSignature[]> {
  const result = await db.execute({
    sql: "SELECT * FROM rfq_nda_signatures WHERE rfq_id = ? AND signer_id = ? ORDER BY signed_at DESC",
    args: [rfqId, signerId],
  });
  return result.rows.map(mapSignature);
}

export async function getNdaSignature(db: Client, id: string): Promise<NdaSignature | null> {
  const result = await db.execute({ sql: "SELECT * FROM rfq_nda_signatures WHERE id = ?", args: [id] });
  const row = result.rows[0];
  return row ? mapSignature(row) : null;
}

/** Distinct businesses that signed an earlier NDA revision (to ask them to re-sign). */
export async function listSignerIds(db: Client, rfqId: string): Promise<string[]> {
  const result = await db.execute({
    sql: "SELECT DISTINCT signer_id FROM rfq_nda_signatures WHERE rfq_id = ?",
    args: [rfqId],
  });
  return result.rows.map((row) => String(row.signer_id));
}

function mapSignature(row: Record<string, unknown>): NdaSignature {
  const s = (v: unknown) => (v == null ? "" : String(v));
  return {
    id: s(row.id),
    rfqId: s(row.rfq_id),
    ndaRevision: Number(row.nda_revision ?? 0),
    ndaHash: s(row.nda_hash),
    ndaMode: (s(row.nda_mode) as NdaMode) || "template",
    ndaText: s(row.nda_text),
    ndaFileId: row.nda_file_id ? s(row.nda_file_id) : null,
    signerId: s(row.signer_id),
    companyId: row.company_id ? s(row.company_id) : null,
    businessName: s(row.business_name),
    signerName: s(row.signer_name),
    signerTitle: s(row.signer_title),
    ip: s(row.ip),
    userAgent: s(row.user_agent),
    signedAt: Number(row.signed_at ?? 0),
  };
}

export function ndaHash(input: { mode: NdaMode; text?: string; fileId?: string | null; revision: number }): string {
  const material =
    input.mode === "custom"
      ? `custom:${input.fileId ?? ""}:${input.revision}`
      : `${NDA_TEMPLATE_VERSION}:${input.revision}:${input.text ?? ""}`;
  return createHash("sha256").update(material).digest("hex");
}

