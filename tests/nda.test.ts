import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Client } from "@libsql/client";
import { createDbClient, migrate } from "@/lib/db";
import { canAccessFile, ndaTemplateText, needsNdaSignature, parseSignature } from "@/lib/nda";
import {
  canDownloadRfqFile,
  listNdaSignatures,
  mustSignNda,
  ndaHash,
  recordNdaSignature,
} from "@/lib/nda-repo";
import { insertUser } from "@/lib/repo";
import type { RfqInput } from "@/lib/rfq";
import { getRfqById, insertRfq, insertRfqFile, listRfqChanges, listRfqFiles, reviseRfq } from "@/lib/rfq-repo";

const files: string[] = [];
afterEach(() => {
  for (const file of files.splice(0)) {
    for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(file + suffix, { force: true });
  }
});

const base: RfqInput = {
  title: "Machined manifolds",
  category: "metal",
  subtype: "aluminum",
  quantity: 20,
  unit: "pcs",
  specs: "6061-T6 per drawing",
  neededBy: null,
  deliveryZip: "92111",
  deliveryLocation: "",
  budgetCents: null,
  expiresOn: "2099-01-01",
};

describe("NDA rules (pure)", () => {
  const rfq = { ownerId: "buyer", ndaMode: "template" as const, ndaRevision: 2 };
  const drawing = { quoteId: null, uploaderId: "buyer", kind: "attachment" };

  it("requires a signature on the current revision", () => {
    expect(needsNdaSignature(rfq, "buyer", [])).toBe(false);
    expect(needsNdaSignature(rfq, "sup", [])).toBe(true);
    expect(needsNdaSignature(rfq, "sup", [1])).toBe(true);
    expect(needsNdaSignature(rfq, "sup", [1, 2])).toBe(false);
    expect(needsNdaSignature({ ...rfq, ndaMode: "none" }, "sup", [])).toBe(false);
  });

  it("gates drawings but not the NDA PDF itself", () => {
    expect(canAccessFile(drawing, "sup", rfq, [])).toBe(false);
    expect(canAccessFile(drawing, "sup", rfq, [2])).toBe(true);
    expect(canAccessFile(drawing, "buyer", rfq, [])).toBe(true);
    expect(canAccessFile({ ...drawing, kind: "nda" }, "sup", rfq, [])).toBe(true);
    const quoteFile = { quoteId: "q1", uploaderId: "sup", kind: "attachment" };
    expect(canAccessFile(quoteFile, "other", rfq, [2])).toBe(false);
    expect(canAccessFile(quoteFile, "buyer", rfq, [])).toBe(true);
  });

  it("validates the signature form", () => {
    expect(parseSignature({ signerName: "Pat", signerTitle: "Owner", agree: "on" }).ok).toBe(false);
    expect(parseSignature({ signerName: "Pat Lee", signerTitle: "Owner", agree: null }).ok).toBe(false);
    const ok = parseSignature({ signerName: "  Pat   Lee ", signerTitle: "Owner", agree: "on" });
    expect(ok.ok && ok.value.signerName).toBe("Pat Lee");
  });

  it("fills the template and hashes by revision", () => {
    const text = ndaTemplateText({ buyerName: "Acme", quoterName: "Bolt Co", rfqTitle: "T", rfqId: "r1", date: "Oct 1" });
    expect(text).toContain("Acme");
    expect(text).toContain("Bolt Co");
    expect(text).toContain("r1");
    expect(ndaHash({ mode: "template", text, revision: 1 })).not.toBe(ndaHash({ mode: "template", text, revision: 2 }));
  });
});

describe("NDA gate (db)", () => {
  it("locks files until signed and requires re-sign after the NDA changes", async () => {
    const db = await tempDb();
    for (const id of ["buyer", "sup"]) {
      await insertUser(db, { id, email: `${id}@x.com`, passwordHash: "h", shopName: `${id} Co`, zip: "92111" });
    }
    await insertRfq(db, { ...base, id: "r1", ownerId: "buyer", ndaMode: "template" });
    await insertRfqFile(db, {
      id: "f1", rfqId: "r1", quoteId: null, uploaderId: "buyer", name: "manifold.pdf",
      pathname: "p/1", contentType: "application/pdf", size: 10,
    });
    let rfq = (await getRfqById(db, "r1"))!;
    expect(rfq.ndaMode).toBe("template");
    expect(rfq.ndaRevision).toBe(1);
    const file = (await listRfqFiles(db, "r1"))[0];

    expect(await mustSignNda(db, rfq, "sup")).toBe(true);
    expect(await mustSignNda(db, rfq, "buyer")).toBe(false);
    expect(await canDownloadRfqFile(db, file, "sup", rfq)).toBe(false);

    const sig = await recordNdaSignature(db, {
      rfq, signerId: "sup", signerName: "Pat Lee", signerTitle: "Owner", ip: "1.2.3.4", userAgent: "UA",
    });
    expect(sig?.businessName).toBe("sup Co");
    expect(sig?.ndaText).toContain("sup Co");
    expect(await recordNdaSignature(db, { rfq, signerId: "buyer", signerName: "B B", signerTitle: "x", ip: "", userAgent: "" })).toBeNull();
    expect(await canDownloadRfqFile(db, file, "sup", rfq)).toBe(true);
    expect((await listNdaSignatures(db, "r1")).map((s) => [s.signerId, s.ip])).toEqual([["sup", "1.2.3.4"]]);

    // Owner replaces the NDA with their own PDF: revision bumps, history logged, sup must re-sign.
    const rev = await reviseRfq(db, {
      rfqId: "r1", ownerId: "buyer", next: base, changes: [], fileOps: [],
      nda: { mode: "custom", file: { id: "nda1", rfqId: "r1", quoteId: null, uploaderId: "buyer", name: "our-nda.pdf", pathname: "p/n", contentType: "application/pdf", size: 5 } },
    });
    expect(rev).toBe(2);
    rfq = (await getRfqById(db, "r1"))!;
    expect(rfq.ndaMode).toBe("custom");
    expect(rfq.ndaRevision).toBe(2);
    expect(rfq.ndaFileId).toBe("nda1");
    expect(await mustSignNda(db, rfq, "sup")).toBe(true);
    expect(await canDownloadRfqFile(db, file, "sup", rfq)).toBe(false);
    // NDA PDF is readable before signing and hidden from the drawings list.
    expect(await canDownloadRfqFile(db, { quoteId: null, uploaderId: "buyer", kind: "nda" }, "sup", rfq)).toBe(true);
    expect((await listRfqFiles(db, "r1")).map((f) => f.id)).toEqual(["f1"]);
    const changes = await listRfqChanges(db, "r1");
    expect(changes.find((c) => c.field === "nda")?.newValue).toContain("our-nda.pdf");

    await recordNdaSignature(db, { rfq, signerId: "sup", signerName: "Pat Lee", signerTitle: "Owner", ip: "", userAgent: "" });
    expect(await canDownloadRfqFile(db, file, "sup", rfq)).toBe(true);

    // Turning the NDA off opens files without a new signature.
    await reviseRfq(db, { rfqId: "r1", ownerId: "buyer", next: base, changes: [], fileOps: [], nda: { mode: "none" } });
    rfq = (await getRfqById(db, "r1"))!;
    expect(rfq.ndaMode).toBe("none");
    expect(await mustSignNda(db, rfq, "someone-else")).toBe(false);
  });

  it("migrates twice and defaults old RFQs to no NDA", async () => {
    const db = await tempDb();
    await migrate(db);
    await insertUser(db, { id: "b", email: "b@x.com", passwordHash: "h", shopName: "B", zip: "92111" });
    await insertRfq(db, { ...base, id: "r2", ownerId: "b" });
    const rfq = (await getRfqById(db, "r2"))!;
    expect(rfq.ndaMode).toBe("none");
    expect(await mustSignNda(db, rfq, "x")).toBe(false);
  });
});

async function tempDb(): Promise<Client> {
  const file = path.join(os.tmpdir(), `skrappily-nda-${crypto.randomUUID()}.db`);
  files.push(file);
  const db = createDbClient(`file:${file}`);
  await migrate(db);
  return db;
}
