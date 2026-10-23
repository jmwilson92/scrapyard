"use server";

import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { checkAttachmentSet } from "@/lib/attachments";
import { deletePrivateFile, filesUnavailableReason, putPrivateFile } from "@/lib/file-store";
import type { FormState } from "@/lib/form-state";
import { canPostStage, stageLabel, type OrderStage } from "@/lib/order-stages";
import { addOrderUpdate, getOrderById } from "@/lib/orders-repo";
import { isSafeId } from "@/lib/paths";
import { insertRfqFile, insertRfqMessage } from "@/lib/rfq-repo";
import { getRequestDb } from "@/lib/server-db";
import { getCurrentUser } from "@/lib/session";

/** Supplier posts a progress update: stage, optional note, optional photo/file. */
export async function postOrderUpdateAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const orderId = String(formData.get("orderId") ?? "");
  const stage = String(formData.get("stage") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 1000);
  const values = { stage, note };
  if (!isSafeId(orderId)) notFound();
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/orders/${orderId}`);
  const db = await getRequestDb();
  const order = await getOrderById(db, orderId);
  if (!order || order.sellerId !== user.id) notFound();
  const allowed = canPostStage(order, stage);
  if (!allowed.ok) return { errors: { stage: allowed.error }, values };
  if (stage === order.stage && !note && !(formData.get("file") instanceof File && (formData.get("file") as File).size > 0)) {
    return { errors: { note: "Add a note or a photo, or pick the next stage." }, values };
  }

  const updateId = crypto.randomUUID();
  let fileId: string | null = null;
  let pathname: string | null = null;
  const entry = formData.get("file");
  if (entry instanceof File && entry.size > 0) {
    const unavailable = filesUnavailableReason();
    if (unavailable) return { errors: { file: unavailable }, values };
    if (!order.rfqId || !order.quoteId) return { errors: { file: "Files need an RFQ order." }, values };
    const bytes = new Uint8Array(await entry.arrayBuffer());
    const checked = checkAttachmentSet([{ name: entry.name, size: entry.size, head: bytes.slice(0, 16) }], 1);
    if (!checked.ok) return { errors: { file: checked.error }, values };
    const meta = checked.value[0];
    fileId = crypto.randomUUID();
    pathname = `rfq/${order.rfqId}/orders/${order.id}/${fileId}-${meta.name}`;
    await putPrivateFile(pathname, bytes, meta.contentType);
    // Stored as a quote-scoped file: only the buyer (RFQ owner) and supplier can open it.
    await insertRfqFile(db, {
      id: fileId,
      rfqId: order.rfqId,
      quoteId: order.quoteId,
      uploaderId: user.id,
      name: meta.name,
      pathname,
      contentType: meta.contentType,
      size: meta.size,
      orderUpdateId: updateId,
    });
  }

  try {
    await addOrderUpdate(db, { id: updateId, orderId, sellerId: user.id, stage: stage as OrderStage, note, fileId });
  } catch (error) {
    if (pathname) await deletePrivateFile(pathname);
    throw error;
  }

  if (order.rfqId) {
    await insertRfqMessage(db, {
      id: crypto.randomUUID(),
      rfqId: order.rfqId,
      senderId: user.id,
      recipientId: order.buyerId,
      body: `Order update for "${order.title}": ${stageLabel(stage)}.${note ? ` ${note}` : ""}${fileId ? " (photo/file attached on the order page)" : ""}`,
    });
  }
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  revalidatePath("/inbox");
  return { errors: {}, values: {}, success: `Update posted: ${stageLabel(stage)}. The buyer was notified.` };
}
