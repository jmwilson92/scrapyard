import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { MessageForm } from "@/components/message-form";
import { DatabaseSetup } from "@/components/database-setup";
import { Shell } from "@/components/shell";
import { formatWhen } from "@/lib/format";
import { isSafeId } from "@/lib/paths";
import { listThreadMessages, markThreadRead } from "@/lib/repo";
import { loadRequestDb } from "@/lib/server-db";
import { getCurrentUser } from "@/lib/session";

type Params = Promise<{ listingId: string; userId: string }>;

export default function ThreadPage({ params }: { params: Params }) {
  return (
    <Shell>
      <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-muted" />}>
        <Thread params={params} />
      </Suspense>
    </Shell>
  );
}

async function Thread({ params }: { params: Params }) {
  const { listingId, userId: otherUserId } = await params;
  if (!isSafeId(listingId) || !isSafeId(otherUserId)) notFound();

  const loaded = await loadRequestDb();
  if (!loaded.db) return <DatabaseSetup message={loaded.error.message} />;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/inbox/${listingId}/${otherUserId}`);

  const messages = await listThreadMessages(
    loaded.db,
    listingId,
    user.id,
    otherUserId,
  );
  if (messages.length === 0) notFound();
  await markThreadRead(loaded.db, listingId, user.id, otherUserId);

  const title = messages[0]?.listingTitle ?? "Listing";
  const otherShop =
    messages[0]?.senderId === user.id
      ? messages[0]?.recipientShop
      : messages[0]?.senderShop;

  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      <div>
        <Link href="/inbox" className="text-sm font-semibold text-copper">
          Back to inbox
        </Link>
        <h1 className="mt-2 font-display text-4xl tracking-wide">{otherShop}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          About{" "}
          <Link href={`/listings/${listingId}`} className="underline-offset-2 hover:underline">
            {title}
          </Link>
        </p>
      </div>
      <ol className="grid gap-3">
        {messages.map((message) => {
          const mine = message.senderId === user.id;
          return (
            <li
              key={message.id}
              className={
                mine
                  ? "ml-8 rounded-xl bg-primary px-4 py-3 text-primary-foreground"
                  : "mr-8 rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10"
              }
            >
              <p className="text-sm leading-6 whitespace-pre-wrap">{message.body}</p>
              <p
                className={
                  mine
                    ? "mt-2 text-xs text-primary-foreground/70"
                    : "mt-2 text-xs text-muted-foreground"
                }
              >
                {mine ? "You" : message.senderShop} · {formatWhen(message.createdAt)}
              </p>
            </li>
          );
        })}
      </ol>
      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        <MessageForm
          listingId={listingId}
          recipientId={otherUserId}
          label="Reply"
        />
      </div>
    </div>
  );
}
