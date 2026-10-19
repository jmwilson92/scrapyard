"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { DatabaseConfigError } from "@/lib/db";
import { readValues, type FormState } from "@/lib/form-state";
import { isSafeId } from "@/lib/paths";
import {
  deleteListingForSeller,
  getListingById,
  insertListing,
  updateListingStatus,
} from "@/lib/repo";
import { getRequestDb } from "@/lib/server-db";
import { getCurrentUser } from "@/lib/session";
import { deleteStoredPhoto, saveListingPhoto } from "@/lib/storage";
import { parseListingForm } from "@/lib/validation";
import { lookupZip } from "@/lib/zip";

const LISTING_FIELDS = [
  "title",
  "material",
  "alloy",
  "form",
  "lengthIn",
  "widthIn",
  "thicknessIn",
  "diameterIn",
  "quantity",
  "weightLbs",
  "price",
  "zip",
  "notes",
  "isFree",
];

export async function createListingAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = readValues(formData, LISTING_FIELDS);
  const user = await getCurrentUser();
  if (!user) {
    return { errors: {}, values, formError: "Sign in before listing a drop." };
  }

  const raw: Record<string, FormDataEntryValue | string | undefined> = {};
  for (const key of LISTING_FIELDS) raw[key] = values[key] ?? "";
  const parsed = parseListingForm(raw, (zip) => lookupZip(zip) != null);
  if (!parsed.ok) return { errors: parsed.errors, values };

  let photoUrl: string | null = null;
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    const saved = await saveListingPhoto(photo);
    if (!saved.ok) return { errors: { photo: saved.error }, values };
    photoUrl = saved.url;
  }

  const id = crypto.randomUUID();
  try {
    const db = await getRequestDb();
    await insertListing(db, {
      ...parsed.value,
      id,
      sellerId: user.id,
      photoUrl,
    });
  } catch (error) {
    await deleteStoredPhoto(photoUrl);
    if (error instanceof DatabaseConfigError) {
      return { errors: {}, values, formError: error.message };
    }
    throw error;
  }

  revalidatePath("/browse");
  revalidatePath("/");
  revalidatePath("/account");
  redirect(`/listings/${id}`);
}

export async function setListingStatusAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  const id = stringField(formData, "id");
  const status = stringField(formData, "status");
  if (!user) redirect(`/login?next=/listings/${id}`);
  if (!isSafeId(id) || (status !== "sold" && status !== "active")) notFound();

  const db = await getRequestDb();
  const updated = await updateListingStatus(db, id, user.id, status);
  if (!updated) notFound();
  revalidatePath(`/listings/${id}`);
  revalidatePath("/browse");
  revalidatePath("/account");
  revalidatePath("/");
}

export async function deleteListingAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  const id = stringField(formData, "id");
  if (!user) redirect("/login?next=/account");
  if (!isSafeId(id)) notFound();

  const db = await getRequestDb();
  const listing = await getListingById(db, id);
  if (!listing || listing.sellerId !== user.id) notFound();
  const removed = await deleteListingForSeller(db, id, user.id);
  if (!removed) notFound();
  await deleteStoredPhoto(listing.photoUrl);
  revalidatePath("/browse");
  revalidatePath("/account");
  revalidatePath("/");
  redirect("/account?deleted=1");
}

function stringField(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}
