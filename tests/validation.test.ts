import { describe, expect, it } from "vitest";
import { detectImage } from "@/lib/images";
import { groupInboxThreads } from "@/lib/inbox";
import { formatDimensions } from "@/lib/format";
import { SEED_LISTINGS, SEED_SHOPS } from "@/lib/seed-data";
import type { MessageRow } from "@/lib/types";
import { parseListingForm, parseMessageBody, parseReport } from "@/lib/validation";
import { lookupZip } from "@/lib/zip";

const zipExists = (zip: string) => lookupZip(zip) != null;

describe("parseListingForm", () => {
  it("accepts a priced lot and a free lot", () => {
    const priced = parseListingForm(
      {
        title: "6061 drops",
        material: "aluminum",
        alloy: "6061-T6",
        form: "round",
        diameterIn: "1.5",
        lengthIn: "24",
        quantity: "6",
        weightLbs: "25",
        price: "36",
        zip: "92111-1234",
        notes: "Saw cut.",
      },
      zipExists,
    );
    expect(priced.ok).toBe(true);
    if (!priced.ok) return;
    expect(priced.value.priceCents).toBe(3600);
    expect(priced.value.zip).toBe("92111");

    const free = parseListingForm(
      {
        title: "Acetal ends",
        material: "plastic",
        alloy: "Acetal",
        form: "round",
        diameterIn: "2",
        lengthIn: "10",
        quantity: "3",
        isFree: "on",
        price: "50",
        zip: "92121",
      },
      zipExists,
    );
    expect(free.ok).toBe(true);
    if (!free.ok) return;
    expect(free.value.priceCents).toBeNull();
  });

  it("requires a price or the free flag, a dimension, and a real ZIP", () => {
    const missing = parseListingForm(
      {
        title: "No",
        material: "nope",
        alloy: "",
        form: "cube",
        quantity: "0",
        zip: "00000",
      },
      zipExists,
    );
    expect(missing.ok).toBe(false);
    if (missing.ok) return;
    expect(missing.errors.title).toBeTruthy();
    expect(missing.errors.material).toBeTruthy();
    expect(missing.errors.alloy).toBeTruthy();
    expect(missing.errors.form).toBeTruthy();
    expect(missing.errors.lengthIn).toBeTruthy();
    expect(missing.errors.quantity).toBeTruthy();
    expect(missing.errors.price).toBeTruthy();
    expect(missing.errors.zip).toBeTruthy();
  });
});

describe("messages and reports", () => {
  it("rejects empty and oversized messages", () => {
    expect(parseMessageBody("  ")).toEqual({
      ok: false,
      error: "Write a message first.",
    });
    expect(parseMessageBody("x".repeat(2001)).ok).toBe(false);
    expect(parseMessageBody("Still there?").ok).toBe(true);
  });

  it("requires a known report reason", () => {
    expect(parseReport("spam", "copied listing").ok).toBe(true);
    expect(parseReport("whatever", "").ok).toBe(false);
  });
});

describe("seed data", () => {
  it("has example listings on real San Diego area ZIPs", () => {
    expect(SEED_LISTINGS.length).toBe(23);
    expect(new Set(SEED_LISTINGS.map((row) => row.material)).size).toBe(9);
    for (const listing of SEED_LISTINGS) {
      expect(SEED_SHOPS.some((shop) => shop.id === listing.sellerId)).toBe(true);
      expect(lookupZip(listing.zip)?.state).toBe("CA");
      const parsed = parseListingForm(
        {
          title: listing.title,
          category: listing.category,
          subtype: listing.subtype,
          material: listing.material,
          metalType: listing.metalType,
          alloy: listing.alloy,
          form: listing.form,
          lengthIn: listing.lengthIn?.toString() ?? "",
          widthIn: listing.widthIn?.toString() ?? "",
          thicknessIn: listing.thicknessIn?.toString() ?? "",
          diameterIn: listing.diameterIn?.toString() ?? "",
          quantity: String(listing.quantity),
          weightLbs: listing.weightLbs?.toString() ?? "",
          price: listing.priceCents == null ? "" : String(listing.priceCents / 100),
          isFree: listing.priceCents == null ? "on" : "",
          zip: listing.zip,
          notes: listing.notes,
          deliveryMode: listing.deliveryMode,
          deliveryRadius: listing.deliveryRadiusMiles?.toString() ?? "",
          deliveryFee:
            listing.deliveryFeeCents == null ? "" : String(listing.deliveryFeeCents / 100),
          certsAvailable: listing.certsAvailable ? "on" : "",
          certsNote: listing.certsNote,
        },
        zipExists,
      );
      expect(parsed.ok, listing.id).toBe(true);
      if (!parsed.ok) continue;
      expect(parsed.value.metalType).toBe(listing.metalType);
      expect(parsed.value.form).toBe(listing.form);
      expect(parsed.value.deliveryMode).toBe(listing.deliveryMode);
      expect(parsed.value.deliveryRadiusMiles).toBe(listing.deliveryRadiusMiles);
      expect(parsed.value.deliveryFeeCents).toBe(listing.deliveryFeeCents);
      expect(parsed.value.certsAvailable).toBe(listing.certsAvailable);
      expect(parsed.value.certsNote).toBe(listing.certsNote);
    }
  });
});

describe("delivery and metal type", () => {
  it("stores seller delivery with an optional radius and fee", () => {
    const parsed = parseListingForm(
      {
        title: "316 tube drops",
        metalType: "ss-316",
        alloy: "316",
        form: "tube-pipe",
        diameterIn: "1.5",
        thicknessIn: "0.065",
        lengthIn: "48",
        quantity: "3",
        price: "70",
        zip: "91950",
        deliveryMode: "delivery",
        deliveryRadius: "40",
        deliveryFee: "50",
      },
      zipExists,
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.material).toBe("stainless");
    expect(parsed.value.metalType).toBe("ss-316");
    expect(parsed.value.deliveryMode).toBe("delivery");
    expect(parsed.value.deliveryRadiusMiles).toBe(40);
    expect(parsed.value.deliveryFeeCents).toBe(5000);
  });

  it("ignores delivery details when the lot is pickup only", () => {
    const parsed = parseListingForm(
      {
        title: "6061 drops",
        metalType: "al-6061",
        alloy: "6061-T6",
        form: "round",
        diameterIn: "1.5",
        lengthIn: "24",
        quantity: "6",
        price: "36",
        zip: "92111",
        deliveryMode: "pickup",
        deliveryRadius: "10",
        deliveryFee: "15",
      },
      zipExists,
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.form).toBe("bar-round");
    expect(parsed.value.deliveryMode).toBe("pickup");
    expect(parsed.value.deliveryRadiusMiles).toBeNull();
    expect(parsed.value.deliveryFeeCents).toBeNull();
  });

  it("keeps a cert note only when certs are offered", () => {
    const offered = parseListingForm(
      {
        title: "304 sheet",
        metalType: "ss-304",
        alloy: "304",
        form: "plate-sheet",
        thicknessIn: "0.06",
        widthIn: "24",
        lengthIn: "36",
        quantity: "1",
        price: "48",
        zip: "91910",
        certsAvailable: "on",
        certsNote: "Certificate of conformance from the service center.",
      },
      zipExists,
    );
    expect(offered.ok).toBe(true);
    if (!offered.ok) return;
    expect(offered.value.certsAvailable).toBe(true);
    expect(offered.value.certsNote).toContain("conformance");

    const hidden = parseListingForm(
      {
        title: "304 sheet",
        metalType: "ss-304",
        alloy: "304",
        form: "plate-sheet",
        thicknessIn: "0.06",
        widthIn: "24",
        lengthIn: "36",
        quantity: "1",
        price: "48",
        zip: "91910",
        certsNote: "Should be ignored",
      },
      zipExists,
    );
    expect(hidden.ok).toBe(true);
    if (!hidden.ok) return;
    expect(hidden.value.certsAvailable).toBe(false);
    expect(hidden.value.certsNote).toBe("");

    const long = parseListingForm(
      {
        title: "304 sheet",
        metalType: "ss-304",
        alloy: "304",
        form: "plate-sheet",
        thicknessIn: "0.06",
        widthIn: "24",
        lengthIn: "36",
        quantity: "1",
        price: "48",
        zip: "91910",
        certsAvailable: "on",
        certsNote: "x".repeat(301),
      },
      zipExists,
    );
    expect(long.ok).toBe(false);
    if (long.ok) return;
    expect(long.errors.certsNote).toBeTruthy();
  });

  it("rejects a delivery radius outside 1 to 500 miles", () => {
    const parsed = parseListingForm(
      {
        title: "Bronze rounds",
        metalType: "bronze",
        alloy: "932",
        form: "bar-round",
        diameterIn: "1",
        lengthIn: "8",
        quantity: "1",
        price: "40",
        zip: "91950",
        deliveryMode: "delivery",
        deliveryRadius: "900",
      },
      zipExists,
    );
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.errors.deliveryRadius).toBeTruthy();
  });
});

describe("formatDimensions", () => {
  it("labels tube and round stock differently", () => {
    expect(
      formatDimensions({
        form: "tube",
        diameterIn: 1.5,
        thicknessIn: 0.065,
        lengthIn: 48,
        widthIn: null,
      }),
    ).toBe('1.5" OD × 0.065" wall × 48" L');
    expect(
      formatDimensions({
        form: "round",
        diameterIn: 0.75,
        lengthIn: 12,
        widthIn: null,
        thicknessIn: null,
      }),
    ).toBe('0.75" dia × 12" L');
  });
});

describe("groupInboxThreads", () => {
  it("groups a conversation and counts unread replies", () => {
    const rows: MessageRow[] = [
      message("m1", "buyer", "seller", "Is it still there?", 10, 11),
      message("m2", "seller", "buyer", "Yes, out back.", 20, null),
    ];
    const buyer = groupInboxThreads(rows, "buyer");
    expect(buyer).toHaveLength(1);
    expect(buyer[0]).toMatchObject({
      otherUserId: "seller",
      otherShopName: "Seller Shop",
      lastBody: "Yes, out back.",
      unread: 1,
    });
    expect(groupInboxThreads(rows, "seller")[0]?.unread).toBe(0);
  });
});

describe("detectImage", () => {
  it("recognizes jpeg, png, and webp signatures", () => {
    expect(detectImage(Uint8Array.from([0xff, 0xd8, 0xff, 0x00]))).toBe("jpg");
    expect(
      detectImage(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0])),
    ).toBe("png");
    const webp = new Uint8Array(12);
    webp.set([0x52, 0x49, 0x46, 0x46], 0);
    webp.set([0x57, 0x45, 0x42, 0x50], 8);
    expect(detectImage(webp)).toBe("webp");
    expect(detectImage(Uint8Array.from([1, 2, 3]))).toBeNull();
  });
});

function message(
  id: string,
  senderId: string,
  recipientId: string,
  body: string,
  createdAt: number,
  readAt: number | null,
): MessageRow {
  return {
    id,
    listingId: "ex-01",
    listingTitle: "6061 drops",
    senderId,
    senderShop: senderId === "buyer" ? "Buyer Shop" : "Seller Shop",
    recipientId,
    recipientShop: recipientId === "buyer" ? "Buyer Shop" : "Seller Shop",
    body,
    createdAt,
    readAt,
  };
}
