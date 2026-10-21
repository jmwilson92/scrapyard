import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { RegisterForm } from "@/components/auth-forms";
import { Shell } from "@/components/shell";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "Create a business account" };

export default function RegisterPage() {
  return (
    <Shell>
      <div className="mx-auto max-w-lg">
        <h1 className="text-3xl font-bold tracking-tight">Create a business account</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Skrappily is for businesses only: shops, fabricators, contractors,
          manufacturers, distributors, and recyclers buying and selling
          material with each other. Tell us about your company.
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
