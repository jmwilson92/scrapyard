import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Client } from "@libsql/client";
import { createDbClient, migrate } from "@/lib/db";
import { canPostStage, stageIndex, stageProgress, statusForStage } from "@/lib/order-stages";
import { addOrderUpdate, getOrderById, insertOrder, listOrderUpdates } from "@/lib/orders-repo";
import { supplierQuoteStatus } from "@/lib/quote-status";
import { insertUser } from "@/lib/repo";
import type { RfqInput } from "@/lib/rfq";
import { diffRfq, revLabel } from "@/lib/rfq-history";
import {
  getRfqById,
  insertQuote,
  insertRfq,
  insertRfqFile,
  listActiveQuoterIds,
  listQuotesByQuoter,
  listRfqChanges,
  listRfqFiles,
  reviseRfq,
  withdrawQuote,
} from "@/lib/rfq-repo";

const files: string[] = [];
afterEach(() => {
  for (const file of files.splice(0)) {
    for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(file + suffix, { force: true });
  }
});

const base: RfqInput = {
  title: "Laser-cut brackets",
  category: "metal",
  subtype: "steel",
  quantity: 100,
  unit: "pcs",
  specs: "A36, 1/4 in",
  neededBy: "2099-02-01",
  deliveryZip: "92111",
  deliveryLocation: "",
  budgetCents: 500_000,
  expiresOn: "2099-01-01",
};

describe("pure helpers", () => {
  it("labels revisions like drawings", () => {
    expect(revLabel(1)).toBe("Rev A");
    expect(revLabel(2)).toBe("Rev B");
    expect(revLabel(26)).toBe("Rev Z");
    expect(revLabel(27)).toBe("Rev AA");
  });

  it("diffs only changed fields", () => {
    expect(diffRfq(base, { ...base })).toEqual([]);
    const changes = diffRfq(base, { ...base, quantity: 120, expiresOn: "2099-01-15", budgetCents: null });
    expect(changes.map((c) => c.field).sort()).toEqual(["budgetCents", "expiresOn", "quantity"]);
    const due = changes.find((c) => c.field === "expiresOn")!;
    expect(due.oldValue).toContain("2099-01-01");
    expect(due.newValue).toContain("2099-01-15");
  });

  it("derives a supplier-facing quote status", () => {
    const open = { status: "open", expiresOn: "2099-01-01" };
    const today = "2026-10-22";
    expect(supplierQuoteStatus({ status: "submitted", validUntil: "2099-01-01" }, open, today)).toBe("pending");
    expect(supplierQuoteStatus({ status: "accepted", validUntil: "2000-01-01" }, open, today)).toBe("accepted");
    expect(supplierQuoteStatus({ status: "withdrawn", validUntil: "2099-01-01" }, open, today)).toBe("withdrawn");
    expect(supplierQuoteStatus({ status: "submitted", validUntil: "2026-10-01" }, open, today)).toBe("expired");
    expect(supplierQuoteStatus({ status: "submitted", validUntil: "2099-01-01" }, { ...open, expiresOn: "2026-10-01" }, today)).toBe("expired");
    expect(supplierQuoteStatus({ status: "submitted", validUntil: "2099-01-01" }, { ...open, status: "closed" }, today)).toBe("rfq-closed");
  });

  it("only moves the stage forward on paid orders", () => {
    expect(canPostStage({ status: "pending", stage: "placed" }, "sourcing").ok).toBe(false);
    expect(canPostStage({ status: "refunded", stage: "placed" }, "sourcing").ok).toBe(false);
    expect(canPostStage({ status: "paid", stage: "placed" }, "production").ok).toBe(true);
    expect(canPostStage({ status: "paid", stage: "production" }, "sourcing").ok).toBe(false);
    expect(canPostStage({ status: "paid", stage: "production" }, "production").ok).toBe(true);
    expect(canPostStage({ status: "paid", stage: "placed" }, "bogus").ok).toBe(false);
    expect(stageProgress("placed")).toBe(0);
    expect(stageProgress("delivered")).toBe(100);
    expect(stageIndex("nope")).toBe(0);
    expect(statusForStage("shipped", "paid")).toBe("shipped");
    expect(statusForStage("delivered", "shipped")).toBe("completed");
    expect(statusForStage("production", "paid")).toBe("paid");
  });
});

describe("RFQ revisions", () => {
  it("logs changes, keeps old drawings, and flags outdated quotes", async () => {
    const db = await tempDb();
    for (const id of ["buyer", "supA", "supB"]) {
      await insertUser(db, { id, email: `${id}@x.com`, passwordHash: "h", shopName: `${id} Co`, zip: "92111" });
    }
    await migrate(db);
    await insertRfq(db, { ...base, id: "rfq-1", ownerId: "buyer" });
    await insertRfqFile(db, {
      id: "f1", rfqId: "rfq-1", quoteId: null, uploaderId: "buyer", name: "bracket.pdf",
      pathname: "p/1", contentType: "application/pdf", size: 10,
    });
    const q = { priceCents: 100_000, priceBasis: "total" as const, quantity: 100, leadTimeDays: 5, notes: "", validUntil: "2099-01-01" };
    await insertQuote(db, { ...q, id: "qa", rfqId: "rfq-1", quoterId: "supA" });
    await insertQuote(db, { ...q, id: "qb", rfqId: "rfq-1", quoterId: "supB" });
    expect(await withdrawQuote(db, "qb", "supA")).toBe(false);
    expect(await withdrawQuote(db, "qb", "supB")).toBe(true);
    expect(await withdrawQuote(db, "qb", "supB")).toBe(false);
    expect(await listActiveQuoterIds(db, "rfq-1")).toEqual(["supA"]);

    const next = { ...base, quantity: 120 };
    expect(await reviseRfq(db, { rfqId: "rfq-1", ownerId: "supA", next, changes: diffRfq(base, next), fileOps: [] })).toBeNull();
    expect(await reviseRfq(db, { rfqId: "rfq-1", ownerId: "buyer", next: base, changes: [], fileOps: [] })).toBeNull();
    const rev = await reviseRfq(db, {
      rfqId: "rfq-1",
      ownerId: "buyer",
      next,
      changes: diffRfq(base, next),
      fileOps: [
        { kind: "remove", fileId: "f1", name: "bracket.pdf" },
        {
          kind: "add",
          replacesFileId: "f1",
          replacedName: "bracket.pdf",
          file: { id: "f2", rfqId: "rfq-1", quoteId: null, uploaderId: "buyer", name: "bracket-revB.pdf", pathname: "p/2", contentType: "application/pdf", size: 12 },
        },
      ],
    });
    expect(rev).toBe(2);
    const rfq = await getRfqById(db, "rfq-1");
    expect(rfq?.revision).toBe(2);
    expect(rfq?.quantity).toBe(120);

    const all = await listRfqFiles(db, "rfq-1");
    const old = all.find((f) => f.id === "f1")!;
    const fresh = all.find((f) => f.id === "f2")!;
    expect(old.removedAt).not.toBeNull();
    expect(fresh.revision).toBe(2);
    expect(fresh.removedAt).toBeNull();

    const changes = await listRfqChanges(db, "rfq-1");
    expect(changes.every((c) => c.revision === 2)).toBe(true);
    expect(changes.map((c) => c.field)).toContain("quantity");
    expect(changes[0].changedByName).toBeTruthy();

    const mine = await listQuotesByQuoter(db, "supA");
    expect(mine[0].rfqRevision).toBe(1);
    expect(mine[0].currentRevision).toBe(2);
    expect(mine[0].rfqTitle).toBe("Laser-cut brackets");
  });
});

describe("order progress", () => {
  it("records timestamped stage updates and syncs fulfilment status", async () => {
    const db = await tempDb();
    for (const id of ["buyer", "seller"]) {
      await insertUser(db, { id, email: `${id}@x.com`, passwordHash: "h", shopName: `${id} Co`, zip: "92111" });
    }
    await insertOrder(db, {
      id: "o1", buyerId: "buyer", sellerId: "seller", listingId: null, rfqId: "r", quoteId: "q", title: "T",
      baseCents: 1000, cardFeeCents: 0, amountCents: 1000, feeCents: 10, stripeAccountId: "acct",
    });
    expect((await getOrderById(db, "o1"))?.stage).toBe("placed");
    await db.execute("UPDATE orders SET status = 'paid' WHERE id = 'o1'");
    expect(await addOrderUpdate(db, { id: "u0", orderId: "o1", sellerId: "buyer", stage: "production", note: "", fileId: null })).toBe(false);
    expect(await addOrderUpdate(db, { id: "u1", orderId: "o1", sellerId: "seller", stage: "production", note: "Cutting", fileId: null })).toBe(true);
    expect(await addOrderUpdate(db, { id: "u2", orderId: "o1", sellerId: "seller", stage: "shipped", note: "", fileId: null })).toBe(true);
    let order = await getOrderById(db, "o1");
    expect(order?.stage).toBe("shipped");
    expect(order?.status).toBe("shipped");
    await addOrderUpdate(db, { id: "u3", orderId: "o1", sellerId: "seller", stage: "delivered", note: "", fileId: null });
    order = await getOrderById(db, "o1");
    expect(order?.status).toBe("completed");
    const updates = await listOrderUpdates(db, "o1");
    expect(updates.map((u) => u.id).sort()).toEqual(["u1", "u2", "u3"]);
    expect(updates.find((u) => u.id === "u1")?.note).toBe("Cutting");
  });

  it("migrates twice without error", async () => {
    const db = await tempDb();
    await migrate(db);
    await migrate(db);
  });
});

async function tempDb(): Promise<Client> {
  const file = path.join(os.tmpdir(), `skrappily-track-${crypto.randomUUID()}.db`);
  files.push(file);
  const db = createDbClient(`file:${file}`);
  await migrate(db);
  return db;
}
