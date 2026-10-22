import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { DatabaseSetup } from "@/components/database-setup";
import { RfqMessageForm } from "@/components/rfq-forms";
import { Shell } from "@/components/shell";
import { formatWhen } from "@/lib/format";
import { isSafeId } from "@/lib/paths";
import { findPublicUserById } from "@/lib/repo";
import { canMessageAboutRfq, getRfqById, listRfqThread, markRfqThreadRead } from "@/lib/rfq-repo";
import { loadRequestDb } from "@/lib/server-db";
import { getCurrentUser } from "@/lib/session";

type Params = Promise<{ rfqId: string; userId: string }>;

export const metadata = { title: "RFQ conversation" };

export default function RfqThreadPage({ params }: { params: Params }) {
  return (
    <Shell>
      <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-muted" />}>
        <Thread params={params} />
      </Suspense>
    </Shell>
  );
}

async function Thread({ params }: { params: Params }) {
  const { rfqId, userId: otherUserId } = await params;
  if (!isSafeId(rfqId) || !isSafeId(otherUserId)) notFound();
  const loaded = await loadRequestDb();
  if (!loaded.db) return <DatabaseSetup message={loaded.error.message} />;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/inbox/rfq/${rfqId}/${otherUserId}`);

  const [rfq, other] = await Promise.all([
    getRfqById(loaded.db, rfqId),
    findPublicUserById(loaded.db, otherUserId),
  ]);
  if (!rfq || !other) notFound();
  const messages = await listRfqThread(loaded.db, rfqId, user.id, otherUserId);
  const canWrite = await canMessageAboutRfq(loaded.db, rfq, user.id, otherUserId);
  if (messages.length === 0 && !canWrite) notFound();
  if (messages.length > 0) await markRfqThreadRead(loaded.db, rfqId, user.id, otherUserId);

  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      <div>
        <Link href="/inbox" className="text-sm font-semibold text-copper">Back to inbox</Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{other.shopName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          About RFQ{" "}
          <Link href={`/rfqs/${rfqId}`} className="underline-offset-2 hover:underline">{rfq.title}</Link>
        </p>
      </div>
      {messages.length === 0 ? (
        <p className="rounded-xl bg-card p-4 text-sm ring-1 ring-foreground/10">
          Start the conversation. Messages stay linked to this RFQ.
        </p>
      ) : (
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
                <p className={mine ? "mt-2 text-xs text-primary-foreground/70" : "mt-2 text-xs text-muted-foreground"}>
                  {mine ? "You" : message.senderShop} · {formatWhen(message.createdAt)}
                </p>
              </li>
            );
          })}
        </ol>
      )}
      {!user.profileComplete ? (
        <p className="rounded-xl bg-card p-4 text-sm ring-1 ring-foreground/10">
          <Link href="/account?complete=1" className="font-semibold text-primary">Finish your company profile</Link> to reply.
        </p>
      ) : canWrite ? (
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <RfqMessageForm rfqId={rfqId} recipientId={otherUserId} label={messages.length ? "Reply" : "Message this business"} />
        </div>
      ) : null}
    </div>
  );
}
