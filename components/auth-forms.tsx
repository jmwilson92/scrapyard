"use client";

import { useActionState } from "react";
import { loginAction, registerAction, updateShopAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { emptyFormState } from "@/lib/form-state";

const fieldClass = "h-11 text-base md:text-base";

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, emptyFormState);
  return (
    <form action={action} className="grid gap-4">
      <FormError message={state.formError} />
      <Field label="Shop name" name="shopName" error={state.errors.shopName}>
        <Input
          id="shopName"
          name="shopName"
          className={fieldClass}
          autoComplete="organization"
          defaultValue={state.values.shopName}
          aria-invalid={Boolean(state.errors.shopName)}
          required
        />
      </Field>
      <Field label="Email" name="email" error={state.errors.email}>
        <Input
          id="email"
          name="email"
          type="email"
          className={fieldClass}
          autoComplete="email"
          defaultValue={state.values.email}
          aria-invalid={Boolean(state.errors.email)}
          required
        />
      </Field>
      <Field
        label="Password"
        name="password"
        error={state.errors.password}
        hint="At least 8 characters. Stored as a hash on this board."
      >
        <Input
          id="password"
          name="password"
          type="password"
          className={fieldClass}
          autoComplete="new-password"
          aria-invalid={Boolean(state.errors.password)}
          required
          minLength={8}
        />
      </Field>
      <Field label="Shop ZIP" name="zip" error={state.errors.zip}>
        <Input
          id="zip"
          name="zip"
          className={fieldClass}
          inputMode="numeric"
          autoComplete="postal-code"
          defaultValue={state.values.zip}
          aria-invalid={Boolean(state.errors.zip)}
          required
        />
      </Field>
      <Button type="submit" className="h-11 px-4 text-base" disabled={pending}>
        {pending ? "Creating account…" : "Create shop account"}
      </Button>
    </form>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(loginAction, emptyFormState);
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="next" value={next} />
      <FormError message={state.formError ?? state.errors.form} />
      <Field label="Email" name="email" error={state.errors.email}>
        <Input
          id="email"
          name="email"
          type="email"
          className={fieldClass}
          autoComplete="email"
          defaultValue={state.values.email}
          required
        />
      </Field>
      <Field label="Password" name="password">
        <Input
          id="password"
          name="password"
          type="password"
          className={fieldClass}
          autoComplete="current-password"
          required
        />
      </Field>
      <Button type="submit" className="h-11 px-4 text-base" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

export function ShopForm({
  shopName,
  zip,
}: {
  shopName: string;
  zip: string;
}) {
  const [state, action, pending] = useActionState(updateShopAction, {
    ...emptyFormState,
    values: { shopName, zip },
  });
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <FormError message={state.formError} />
      {state.success ? (
        <p role="status" className="text-sm text-primary sm:col-span-2">
          {state.success}
        </p>
      ) : null}
      <Field label="Shop name" name="shopName" error={state.errors.shopName}>
        <Input
          id="shopName"
          name="shopName"
          className={fieldClass}
          defaultValue={state.values.shopName || shopName}
          required
        />
      </Field>
      <Field label="Shop ZIP" name="zip" error={state.errors.zip}>
        <Input
          id="zip"
          name="zip"
          className={fieldClass}
          inputMode="numeric"
          autoComplete="postal-code"
          defaultValue={state.values.zip || zip}
          required
        />
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit" className="h-11 px-4 text-base" disabled={pending}>
          {pending ? "Saving…" : "Save shop details"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  error,
  hint,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      {children}
      {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
      {error ? (
        <p id={`${name}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {message}
    </p>
  );
}
