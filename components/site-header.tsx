import Link from "next/link";
import { Suspense } from "react";
import { logoutAction } from "@/app/actions/auth";
import { MobileMenu } from "@/components/mobile-menu";
import { TopSearch } from "@/components/top-search";
import { countUnread } from "@/lib/repo";
import { getRequestDb, isDatabaseConfigError } from "@/lib/server-db";
import { getCurrentUser } from "@/lib/session";
import type { PublicUser } from "@/lib/types";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="text-xl font-extrabold tracking-tight text-neutral-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          Skrap<span className="text-primary">pily</span>
        </Link>
        <div className="order-3 w-full min-w-0 flex-1 basis-full lg:order-none lg:basis-0">
          <Suspense fallback={<div className="h-12 rounded-full border-2 border-neutral-200" />}>
            <HeaderSearch />
          </Suspense>
        </div>
        <MobileMenu>
          <HeaderLink href="/browse">Browse</HeaderLink>
          <HeaderLink href="/map">Map</HeaderLink>
          <Suspense fallback={<span className="inline-flex min-h-11 items-center px-2 text-neutral-400 md:min-h-0 md:px-1">Account</span>}>
            <AccountLinks />
          </Suspense>
        </MobileMenu>
      </div>
    </header>
  );
}

async function HeaderSearch() {
  let zip = "";
  try {
    const user = await getCurrentUser();
    zip = user?.zip ?? "";
  } catch (error) {
    if (!isDatabaseConfigError(error)) throw error;
  }
  return <TopSearch defaultZip={zip} />;
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
        <Link
          href="/login?next=/listings/new"
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-3 py-1.5 text-white hover:bg-primary/90 md:min-h-0"
        >
          Sell
        </Link>
        <HeaderLink href="/login">Sign in</HeaderLink>
      </>
    );
  }

  return (
    <>
      <Link
        href="/listings/new"
        className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-3 py-1.5 text-white hover:bg-primary/90 md:min-h-0"
      >
        Sell
      </Link>
      <HeaderLink href="/inbox">
        Inbox
        {unread > 0 ? (
          <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </HeaderLink>
      <HeaderLink href="/account">{user.shopName}</HeaderLink>
      <form action={logoutAction}>
        <button
          type="submit"
          className="min-h-11 w-full rounded-md px-2 py-1 text-left text-neutral-500 md:min-h-0 md:w-auto md:px-1 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
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
      className="inline-flex min-h-11 items-center rounded-md px-2 py-1 text-neutral-700 md:min-h-0 md:px-1 hover:text-neutral-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {children}
    </Link>
  );
}
