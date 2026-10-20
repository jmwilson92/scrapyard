import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DatabaseSetup } from "@/components/database-setup";
import { Shell } from "@/components/shell";
import { formatWhen } from "@/lib/format";
import { groupInboxThreads } from "@/lib/inbox";
import { listMessagesForUser } from "@/lib/repo";
import { loadRequestDb } from "@/lib/server-db";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "Inbox" };

export default function InboxPage() {
  return (
    <Shell>
      <h1 className="text-3xl font-bold tracking-tight">Inbox</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Messages stay on Skrappily. Nothing is emailed.
      </p>
      <div className="mt-6">
        <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-muted" />}>
          <InboxList />
        </Suspense>
      </div>
    </Shell>
  );
}

async function InboxList() {
  const loaded = await loadRequestDb();
  if (!loaded.db) return <DatabaseSetup message={loaded.error.message} />;
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/inbox");

  const threads = groupInboxThreads(
    await listMessagesForUser(loaded.db, user.id),
    user.id,
  );

  if (threads.length === 0) {
    return (
      <p className="rounded-xl bg-card p-5 text-sm leading-6 ring-1 ring-foreground/10">
        No messages yet. Open a listing and write the seller, or wait for a shop
        to ask about one of yours.
      </p>
    );
  }

  return (
    <ul className="grid gap-3">
      {threads.map((thread) => (
        <li key={`${thread.listingId}:${thread.otherUserId}`}>
          <Link
            href={`/inbox/${thread.listingId}/${thread.otherUserId}`}
            className="block rounded-xl bg-card p-4 ring-1 ring-foreground/10 hover:ring-copper"
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-semibold">{thread.otherShopName}</p>
              <p className="text-xs text-muted-foreground">{formatWhen(thread.lastAt)}</p>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{thread.listingTitle}</p>
            <p className="mt-2 line-clamp-2 text-sm">{thread.lastBody}</p>
            {thread.unread > 0 ? (
              <p className="mt-2 text-xs font-semibold text-copper">
                {thread.unread} unread
              </p>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
