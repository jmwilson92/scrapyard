import type { InboxThread, MessageRow } from "@/lib/types";

export function groupInboxThreads(
  rows: readonly MessageRow[],
  userId: string,
): InboxThread[] {
  const threads = new Map<string, InboxThread>();
  const ordered = [...rows].sort((a, b) => a.createdAt - b.createdAt);

  for (const row of ordered) {
    if (row.senderId !== userId && row.recipientId !== userId) continue;
    const otherUserId = row.senderId === userId ? row.recipientId : row.senderId;
    const key = `${row.listingId}:${otherUserId}`;
    const unread = row.recipientId === userId && row.readAt == null ? 1 : 0;
    const existing = threads.get(key);
    if (!existing) {
      threads.set(key, {
        listingId: row.listingId,
        listingTitle: row.listingTitle,
        otherUserId,
        otherShopName:
          row.senderId === userId ? row.recipientShop : row.senderShop,
        lastBody: row.body,
        lastAt: row.createdAt,
        unread,
      });
      continue;
    }
    existing.lastBody = row.body;
    existing.lastAt = row.createdAt;
    existing.unread += unread;
  }

  return [...threads.values()].sort((a, b) => b.lastAt - a.lastAt);
}
