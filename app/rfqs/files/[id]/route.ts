import { connection } from "next/server";
import { readPrivateFile } from "@/lib/file-store";
import { isSafeId } from "@/lib/paths";
import { canDownloadRfqFile } from "@/lib/nda-repo";
import { getRfqById, getRfqFile } from "@/lib/rfq-repo";
import { getRequestDb } from "@/lib/server-db";
import { getCurrentUser } from "@/lib/session";

/** Streams an RFQ/quote attachment to a signed-in business that may see it. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await context.params;
  if (!isSafeId(id)) return new Response("Not found", { status: 404 });
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in with a business account to download attachments.", { status: 401 });
  const db = await getRequestDb();
  const file = await getRfqFile(db, id);
  if (!file) return new Response("Not found", { status: 404 });
  const rfq = await getRfqById(db, file.rfqId);
  if (!rfq) return new Response("Not found", { status: 404 });
  // Server-side NDA gate: drawings stay locked until the current NDA revision is signed.
  if (!(await canDownloadRfqFile(db, file, user.id, rfq))) {
    return file.quoteId
      ? new Response("Not found", { status: 404 })
      : new Response("Sign this RFQ's NDA to download its files.", { status: 403 });
  }
  const stored = await readPrivateFile(file.pathname).catch(() => null);
  if (!stored) return new Response("Not found", { status: 404 });
  return new Response(stored.body as BodyInit, {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `${file.kind === "nda" && file.contentType === "application/pdf" ? "inline" : "attachment"}; filename="${file.name.replace(/"/g, "")}"`,
      "Content-Length": String(file.size),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
