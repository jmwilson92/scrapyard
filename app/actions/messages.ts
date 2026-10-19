"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DatabaseConfigError } from "@/lib/db";
import type { FormState } from "@/lib/form-state";
import { isSafeId } from "@/lib/paths";
import { getListingById, insertMessage, listThreadMessages } from "@/lib/repo";
import { getRequestDb } from "@/lib/server-db";
import { getCurrentUser } from "@/lib/session";
import { parseMessageBody } from "@/lib/validation";

export async function sendMessageAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const listingId = stringField(formData, "listingId");
  const recipientId = stringField(formData, "recipientId");
  const values = { body: stringField(formData, "body") };
  const user = await getCurrentUser();
  if (!user) {
    return { errors: {}, values, formError: "Sign in to message this shop." };
  }
  if (!isSafeId(listingId) || (recipientId && !isSafeId(recipientId))) {
    return { errors: {}, values, formError: "That conversation isn't available." };
  }

  const parsed = parseMessageBody(values.body);
  if (!parsed.ok) return { errors: { body: parsed.error }, values };

  try {
    const db = await getRequestDb();
    const listing = await getListingById(db, listingId);
    if (!listing) {
      return { errors: {}, values, formError: "That listing is no longer on the board." };
    }

    let to = listing.sellerId;
    if (user.id === listing.sellerId) {
      if (!recipientId || recipientId === user.id) {
        return { errors: {}, values, formError: "Choose a buyer to reply to." };
      }
      const existing = await listThreadMessages(db, listingId, user.id, recipientId);
      if (existing.length === 0) {
        return {
          errors: {},
          values,
          formError: "You can reply after a shop messages you about this listing.",
        };
      }
      to = recipientId;
    } else if (recipientId && recipientId !== listing.sellerId) {
      return { errors: {}, values, formError: "Message the shop that listed this drop." };
    }

    if (to === user.id) {
      return { errors: {}, values, formError: "You can't message your own shop." };
    }

    await insertMessage(db, {
      id: crypto.randomUUID(),
      listingId,
      senderId: user.id,
      recipientId: to,
      body: parsed.body,
    });
    revalidatePath("/inbox");
    revalidatePath(`/inbox/${listingId}/${to}`);
    revalidatePath(`/listings/${listingId}`);
    redirect(`/inbox/${listingId}/${to}`);
  } catch (error) {
    if (error instanceof DatabaseConfigError) {
      return { errors: {}, values, formError: error.message };
    }
    throw error;
  }
}

function stringField(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}
