"use server";

import { redirect } from "next/navigation";
import { isSafeId, safeNextPath } from "@/lib/paths";
import { getListingById, insertReport } from "@/lib/repo";
import { getRequestDb } from "@/lib/server-db";
import { getCurrentUser } from "@/lib/session";
import { parseReport } from "@/lib/validation";

export async function reportListingAction(formData: FormData): Promise<void> {
  const listingId = stringField(formData, "listingId");
  if (!isSafeId(listingId)) redirect("/browse");
  const user = await getCurrentUser();
  if (!user) {
    redirect(safeNextPath(`/login?next=/listings/${listingId}`));
  }

  const parsed = parseReport(
    stringField(formData, "reason"),
    stringField(formData, "note"),
  );
  const back = `/listings/${listingId}`;
  if (!parsed.ok) redirect(`${back}?report=invalid`);

  const db = await getRequestDb();
  const listing = await getListingById(db, listingId);
  if (!listing) redirect("/browse");
  if (listing.sellerId === user.id) redirect(`${back}?report=own`);

  const result = await insertReport(db, {
    id: crypto.randomUUID(),
    listingId,
    reporterId: user.id,
    reason: parsed.reason,
    note: parsed.note,
  });
  redirect(result === "duplicate" ? `${back}?report=duplicate` : `${back}?report=sent`);
}

function stringField(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}
