import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Client } from "@libsql/client";
import {
  checkAttachment,
  checkAttachmentSet,
  MAX_ATTACHMENT_BYTES,
  safeFileName,
} from "@/lib/attachments";
import { createDbClient, migrate, seedIfEmpty } from "@/lib/db";
import { groupInboxThreads, threadHref } from "@/lib/inbox";
import { insertMessage, insertUser, listMessagesForUser } from "@/lib/repo";
import {
  acceptsQuotes,
  addDays,
  displayRfqStatus,
  parseQuoteForm,
  parseRfqForm,
  quoteTotalCents,
} from "@/lib/rfq";
import {
  canMessageAboutRfq,
  canViewFile,
  decideQuote,
  getRfqById,
  insertQuote,
  insertRfq,
  insertRfqMessage,
  listQuotesForRfq,
  listRfqs,
  listRfqThread,
} from "@/lib/rfq-repo";
import { lookupZip } from "@/lib/zip";

const zipExists = (zip: string) => lookupZip(zip) != null;
const today = "2026-10-21";
const files: string[] = [];

afterEach(() => {
  for (const file of files.splice(0)) {
    for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(file + suffix, { force: true });
  }
});

const rfqRaw = {
  title: "1/2 in 6061 plate",
  category: "metal",
  subtype: "al-6061",
  quantity: "6",
  unit: "sheets",
  specs: "6061-T6, 0.5 in, 24 x 48, MTR required",
  neededBy: "2026-11-01",
  deliveryZip: "92111",
  budget: "$1,200",
};

describe("RFQ form rules", () => {
  it("parses a full RFQ and defaults the due date to 14 days", () => {
    const parsed = parseRfqForm(rfqRaw, zipExists, today);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.budgetCents).toBe(120000);
    expect(parsed.value.expiresOn).toBe("2026-11-04");
    expect(parsed.value.unit).toBe("sheets");
  });

  it("rejects past dates, bad units, missing specs, and too-long expiry", () => {
    const parsed = parseRfqForm(
      { ...rfqRaw, neededBy: "2026-10-01", unit: "gallons", specs: "x", expiresOn: addDays(today, 200), quantity: "0" },
      zipExists,
      today,
    );
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(Object.keys(parsed.errors).sort()).toEqual(["expiresOn", "neededBy", "quantity", "specs", "unit"]);
  });

  it("parses quotes, totals per-unit prices, and validates fields", () => {
    const quote = parseQuoteForm(
      { price: "45.50", priceBasis: "per-unit", quantity: "6", leadTimeDays: "3", validUntil: "2026-11-01" },
      today,
    );
    expect(quote.ok).toBe(true);
    if (!quote.ok) return;
    expect(quoteTotalCents(quote.value)).toBe(27300);
    expect(quoteTotalCents({ ...quote.value, priceBasis: "total" })).toBe(4550);
    const bad = parseQuoteForm({ price: "-1", priceBasis: "x", quantity: "", leadTimeDays: "900" }, today);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(Object.keys(bad.errors).sort()).toEqual(["leadTimeDays", "price", "priceBasis", "quantity"]);
  });

  it("treats open RFQs past their due date as closed", () => {
    expect(acceptsQuotes({ status: "open", expiresOn: today }, today)).toBe(true);
    expect(acceptsQuotes({ status: "open", expiresOn: "2026-10-20" }, today)).toBe(false);
    expect(displayRfqStatus({ status: "open", expiresOn: "2026-10-20" }, today)).toBe("closed");
    expect(displayRfqStatus({ status: "awarded", expiresOn: "2026-10-20" }, today)).toBe("awarded");
  });
});

describe("attachment rules", () => {
  const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
  it("allows real PDFs and CAD files", () => {
    expect(checkAttachment("Drawing Rev B.pdf", 1000, pdf).ok).toBe(true);
    expect(checkAttachment("part.STEP", 1000, new TextEncoder().encode("ISO-10303-21;")).ok).toBe(true);
    expect(checkAttachment("flat.dxf", 1000, new TextEncoder().encode("0\nSECTION")).ok).toBe(true);
  });

  it("blocks disallowed types, spoofed signatures, executables, and oversize files", () => {
    expect(checkAttachment("run.exe", 10, pdf).ok).toBe(false);
    expect(checkAttachment("fake.pdf", 10, new Uint8Array([0x4d, 0x5a])).ok).toBe(false);
    expect(checkAttachment("evil.step", 10, new Uint8Array([0x4d, 0x5a, 0x90])).ok).toBe(false);
    expect(checkAttachment("big.pdf", MAX_ATTACHMENT_BYTES + 1, pdf).ok).toBe(false);
    expect(checkAttachment("empty.pdf", 0, pdf).ok).toBe(false);
  });

  it("limits file count and total size, and cleans names", () => {
    const one = { name: "a.pdf", size: 1_500_000, head: pdf };
    expect(checkAttachmentSet([one, one], 5).ok).toBe(true);
    expect(checkAttachmentSet([one, one, one], 5).ok).toBe(false);
    expect(checkAttachmentSet([one, one, one], 2).ok).toBe(false);
    expect(safeFileName("../../etc/pass wd<>.pdf")).toBe("pass_wd.pdf");
  });
});

describe("RFQ records", () => {
  it("runs the quote → award flow with permissions and RFQ-linked messages", async () => {
    const db = await tempDb();
    for (const id of ["buyer", "supA", "supB", "stranger"]) {
      await insertUser(db, { id, email: `${id}@x.com`, passwordHash: "h", shopName: `${id} Co`, zip: "92111" });
    }
    await migrate(db); // attaches companies
    const parsed = parseRfqForm(rfqRaw, zipExists, today);
    if (!parsed.ok) throw new Error("fixture");
    await insertRfq(db, { ...parsed.value, expiresOn: "2099-01-01", id: "rfq-1", ownerId: "buyer" });
    const base = { priceCents: 100000, priceBasis: "total" as const, quantity: 6, leadTimeDays: 5, notes: "", validUntil: "2099-01-01" };
    await insertQuote(db, { ...base, id: "q-a", rfqId: "rfq-1", quoterId: "supA" });
    await insertQuote(db, { ...base, id: "q-b", rfqId: "rfq-1", quoterId: "supB", priceCents: 90000 });
    await expect(insertQuote(db, { ...base, id: "q-dup", rfqId: "rfq-1", quoterId: "supA" })).rejects.toThrow();

    const rfq = await getRfqById(db, "rfq-1");
    expect(rfq?.quoteCount).toBe(2);
    expect(rfq?.companyId).toBe("co-buyer");

    expect(await decideQuote(db, "rfq-1", "supA", "q-b", "accepted")).toBe(false); // not owner
    expect(await decideQuote(db, "rfq-1", "buyer", "q-a", "declined")).toBe(true);
    expect(await decideQuote(db, "rfq-1", "buyer", "q-b", "accepted")).toBe(true);
    const quotes = await listQuotesForRfq(db, "rfq-1");
    expect(Object.fromEntries(quotes.map((q) => [q.id, q.status]))).toEqual({ "q-a": "declined", "q-b": "accepted" });
    const awarded = await getRfqById(db, "rfq-1");
    expect(awarded?.status).toBe("awarded");
    expect(awarded?.awardedQuoteId).toBe("q-b");
    expect(await decideQuote(db, "rfq-1", "buyer", "q-a", "accepted")).toBe(false); // already awarded

    // Files: RFQ files for everyone, quote files for quoter + owner only.
    expect(canViewFile({ quoteId: null, uploaderId: "buyer" }, "stranger", "buyer")).toBe(true);
    expect(canViewFile({ quoteId: "q-b", uploaderId: "supB" }, "stranger", "buyer")).toBe(false);
    expect(canViewFile({ quoteId: "q-b", uploaderId: "supB" }, "buyer", "buyer")).toBe(true);

    // Messaging: anyone → owner; owner → quoters only.
    const r = { id: "rfq-1", ownerId: "buyer" };
    expect(await canMessageAboutRfq(db, r, "stranger", "buyer")).toBe(true);
    expect(await canMessageAboutRfq(db, r, "buyer", "supA")).toBe(true);
    expect(await canMessageAboutRfq(db, r, "buyer", "stranger")).toBe(false);
    expect(await canMessageAboutRfq(db, r, "supA", "supB")).toBe(false);
    await insertRfqMessage(db, { id: "m1", rfqId: "rfq-1", senderId: "stranger", recipientId: "buyer", body: "Got plate" });
    expect(await canMessageAboutRfq(db, r, "buyer", "stranger")).toBe(true);

    // Listing messages and RFQ messages share the inbox without colliding.
    await db.execute(`INSERT INTO listings (id, seller_id, title, material, alloy, form, quantity, zip, created_at, updated_at)
      VALUES ('lot-1', 'buyer', 'Steel drops', 'steel', 'A36', 'plate-sheet', 1, '92111', 1, 1)`);
    await insertMessage(db, { id: "m2", listingId: "lot-1", senderId: "stranger", recipientId: "buyer", body: "Lot?" });
    const threads = groupInboxThreads(await listMessagesForUser(db, "buyer"), "buyer");
    expect(threads.map(threadHref).sort()).toEqual(["/inbox/lot-1/stranger", "/inbox/rfq/rfq-1/stranger"]);
    expect(threads.find((t) => t.rfqId)?.listingTitle).toBe("1/2 in 6061 plate");
    expect((await listRfqThread(db, "rfq-1", "buyer", "stranger")).map((m) => m.body)).toEqual(["Got plate"]);
  });

  it("seeds example RFQs from example companies once", async () => {
    const db = await tempDb();
    await seedIfEmpty(db);
    await migrate(db);
    const rfqs = await listRfqs(db);
    expect(rfqs.map((rfq) => rfq.id).sort()).toEqual(["rfq-ex-01", "rfq-ex-02"]);
    expect(rfqs.every((rfq) => rfq.isExample && rfq.companyId?.startsWith("co-"))).toBe(true);
  });
});

async function tempDb(): Promise<Client> {
  const file = path.join(os.tmpdir(), `skrappily-rfq-${crypto.randomUUID()}.db`);
  files.push(file);
  const db = createDbClient(`file:${file}`);
  await migrate(db);
  return db;
}
