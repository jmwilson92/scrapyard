import Link from "next/link";
import { Suspense } from "react";
import { logoutAction } from "@/app/actions/auth";
import { countUnread } from "@/lib/repo";
import { getRequestDb, isDatabaseConfigError } from "@/lib/server-db";
import { getCurrentUser } from "@/lib/session";
import type { PublicUser } from "@/lib/types";

export function SiteHeader() {
  return (
    <header className="bg-primary text-primary-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="font-display text-3xl leading-none tracking-wide focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-copper"
        >
          DROP<span className="text-copper">YARD</span>
        </Link>
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-semibold">
          <HeaderLink href="/browse">Browse</HeaderLink>
          <Suspense fallback={<span className="opacity-70">Account</span>}>
            <AccountLinks />
          </Suspense>
        </nav>
      </div>
    </header>
  );
}

async function AccountLinks() {
  const session = await loadAccount();
  if (session.status === "error") {
    return <HeaderLink href="/browse">Database setup needed</HeaderLink>;
  }
  return <AccountNav user={session.user} unread={session.unread} />;
}

async function loadAccount(): Promise<
  | { status: "ok"; user: PublicUser | null; unread: number }
  | { status: "error" }
> {
  try {
    const user = await getCurrentUser();
    const unread = user ? await unreadFor(user.id) : 0;
    return { status: "ok", user, unread };
  } catch (error) {
    if (!isDatabaseConfigError(error)) throw error;
    return { status: "error" };
  }
}

async function unreadFor(userId: string): Promise<number> {
  const db = await getRequestDb();
  return countUnread(db, userId);
}

function AccountNav({
  user,
  unread,
}: {
  user: PublicUser | null;
  unread: number;
}) {
  if (!user) {
    return (
      <>
        <HeaderLink href="/login?next=/listings/new">List a drop</HeaderLink>
        <HeaderLink href="/login">Sign in</HeaderLink>
        <HeaderLink href="/register">Create account</HeaderLink>
      </>
    );
  }

  return (
    <>
      <HeaderLink href="/listings/new">List a drop</HeaderLink>
      <HeaderLink href="/inbox">
        Inbox
        {unread > 0 ? (
          <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-copper px-1.5 text-xs text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </HeaderLink>
      <HeaderLink href="/account">{user.shopName}</HeaderLink>
      <form action={logoutAction}>
        <button
          type="submit"
          className="rounded-md px-1 py-1 text-primary-foreground/80 hover:text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper"
        >
          Sign out
        </button>
      </form>
    </>
  );
}

function HeaderLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center rounded-md px-1 py-1 text-primary-foreground/85 hover:text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper"
    >
      {children}
    </Link>
  );
}
