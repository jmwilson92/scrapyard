import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth-forms";
import { Shell } from "@/components/shell";
import { DEMO_PASSWORD, SEED_SHOPS } from "@/lib/seed-data";
import { safeNextPath } from "@/lib/paths";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "Sign in" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Shell>
      <div className="mx-auto grid max-w-3xl gap-6 lg:grid-cols-[1fr_0.9fr]">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sign in</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            No email is sent. Your password stays on this board.
          </p>
          <div className="mt-6 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-6">
            <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-muted" />}>
              <LoginGate searchParams={searchParams} />
            </Suspense>
          </div>
          <p className="mt-4 text-sm">
            New business?{" "}
            <Link href="/register" className="font-semibold text-copper">
              Create an account
            </Link>
          </p>
        </div>
        <aside className="rounded-xl bg-secondary p-5">
          <h2 className="text-xl font-bold">Example companies</h2>
          <p className="mt-2 text-sm leading-6">
            Every seeded company uses the password{" "}
            <code className="font-semibold">{DEMO_PASSWORD}</code>. These
            accounts and their listings are sample data.
          </p>
          <ul className="mt-4 grid gap-2 text-sm">
            {SEED_SHOPS.slice(0, 6).map((shop) => (
              <li key={shop.id}>
                <span className="font-semibold">{shop.shopName}</span>
                <br />
                <span className="text-muted-foreground">{shop.email}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-muted-foreground">
            The README lists the rest of the example addresses.
          </p>
        </aside>
      </div>
    </Shell>
  );
}

async function LoginGate({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const next = safeNextPath(first(params.next), "/browse");
  const user = await getCurrentUser();
  if (user) redirect(next);
  return <LoginForm next={next} />;
}

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
