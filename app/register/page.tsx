import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { RegisterForm } from "@/components/auth-forms";
import { Shell } from "@/components/shell";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <Shell>
      <div className="mx-auto max-w-lg">
        <h1 className="font-display text-5xl tracking-wide">Create a shop account</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Email and a password. Nothing is mailed to you. Use the ZIP where
          buyers should start their search.
        </p>
        <div className="mt-6 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-6">
          <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-muted" />}>
            <RegisterGate />
          </Suspense>
        </div>
        <p className="mt-4 text-sm">
          Already listed here?{" "}
          <Link href="/login" className="font-semibold text-copper">
            Sign in
          </Link>
        </p>
      </div>
    </Shell>
  );
}

async function RegisterGate() {
  const user = await getCurrentUser();
  if (user) redirect("/account");
  return <RegisterForm />;
}
