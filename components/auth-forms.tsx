"use client";

import { useActionState } from "react";
import { loginAction, registerAction, updateCompanyAction } from "@/app/actions/auth";
import { BUSINESS_TYPES } from "@/lib/business";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { emptyFormState, type FormState } from "@/lib/form-state";

const fieldClass = "h-11 text-base md:text-base";

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, emptyFormState);
  return (
    <form action={action} className="grid gap-4">
      <FormError message={state.formError} />
      <p className="text-sm font-semibold">Your business</p>
      <CompanyFields state={state} />
      <p className="pt-2 text-sm font-semibold">Sign-in</p>
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
      <Button type="submit" className="h-11 px-4 text-base" disabled={pending}>
        {pending ? "Creating account…" : "Create business account"}
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

export type CompanyDefaults = Record<string, string>;

export function CompanyForm({ defaults }: { defaults: CompanyDefaults }) {
  const [state, action, pending] = useActionState(updateCompanyAction, {
    ...emptyFormState,
    values: defaults,
  });
  return (
    <form action={action} className="grid gap-4">
      <FormError message={state.formError} />
      {state.success ? (
        <p role="status" className="text-sm text-primary">
          {state.success}
        </p>
      ) : null}
      <CompanyFields state={state} />
      <div>
        <Button type="submit" className="h-11 px-4 text-base" disabled={pending}>
          {pending ? "Saving…" : "Save company profile"}
        </Button>
      </div>
    </form>
  );
}

const selectClass =
  "h-11 w-full rounded-lg border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function CompanyFields({ state }: { state: FormState }) {
  const v = state.values;
  const e = state.errors;
  const text = (
    name: string,
    label: string,
    opts: { required?: boolean; hint?: string; auto?: string; mode?: "numeric" | "tel" | "url"; placeholder?: string } = {},
  ) => (
    <Field label={label} name={name} error={e[name]} hint={opts.hint}>
      <Input
        id={name}
        name={name}
        className={fieldClass}
        autoComplete={opts.auto}
        inputMode={opts.mode}
        placeholder={opts.placeholder}
        defaultValue={v[name]}
        aria-invalid={Boolean(e[name])}
        required={opts.required}
      />
    </Field>
  );
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        {text("companyName", "Company name", { required: true, auto: "organization" })}
      </div>
      <Field label="Business type" name="businessType" error={e.businessType}>
        <select
          id="businessType"
          name="businessType"
          defaultValue={v.businessType ?? ""}
          className={selectClass}
          required
        >
          <option value="" disabled>
            Choose one
          </option>
          {BUSINESS_TYPES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </Field>
      {text("contactName", "Contact name", { required: true, auto: "name" })}
      <div className="sm:col-span-2">
        {text("street", "Street address (optional)", { auto: "street-address", hint: "Only city and state show publicly." })}
      </div>
      {text("city", "City", { required: true, auto: "address-level2" })}
      <div className="grid grid-cols-2 gap-4">
        {text("state", "State", { required: true, auto: "address-level1", placeholder: "CA" })}
        {text("zip", "ZIP", { required: true, auto: "postal-code", mode: "numeric" })}
      </div>
      {text("serviceRadius", "Service area, miles (optional)", { mode: "numeric", placeholder: "50" })}
      {text("contactPhone", "Business phone (optional)", { auto: "tel", mode: "tel" })}
      {text("website", "Website (optional)", { auto: "url", mode: "url", placeholder: "example.com" })}
      {text("ein", "EIN (optional)", { placeholder: "12-3456789", hint: "Kept private. Helps us verify your business later." })}
    </div>
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
