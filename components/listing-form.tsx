"use client";

import { useActionState } from "react";
import { createListingAction } from "@/app/actions/listings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FORMS, MATERIALS } from "@/lib/constants";
import { emptyFormState } from "@/lib/form-state";

const fieldClass = "h-11 bg-card text-base md:text-base";

export function ListingForm({ defaultZip }: { defaultZip: string }) {
  const [state, action, pending] = useActionState(createListingAction, {
    ...emptyFormState,
    values: { zip: defaultZip, quantity: "1" },
  });
  const values = state.values;

  return (
    <form action={action} className="grid gap-4">
      {state.formError ? (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.formError}
        </p>
      ) : null}
      <Field label="Title" name="title" error={state.errors.title}>
        <Input
          id="title"
          name="title"
          className={fieldClass}
          defaultValue={values.title}
          placeholder="6061-T6 plate drops, half inch"
          required
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Material" name="material" error={state.errors.material}>
          <Select
            id="material"
            name="material"
            defaultValue={values.material || "aluminum"}
            options={MATERIALS}
          />
        </Field>
        <Field label="Alloy or grade" name="alloy" error={state.errors.alloy}>
          <Input
            id="alloy"
            name="alloy"
            className={fieldClass}
            defaultValue={values.alloy}
            placeholder="6061-T6"
            required
          />
        </Field>
        <Field label="Form" name="form" error={state.errors.form}>
          <Select
            id="form"
            name="form"
            defaultValue={values.form || "round"}
            options={FORMS}
          />
        </Field>
        <Field label="Pieces in the lot" name="quantity" error={state.errors.quantity}>
          <Input
            id="quantity"
            name="quantity"
            className={fieldClass}
            inputMode="numeric"
            defaultValue={values.quantity || "1"}
            required
          />
        </Field>
      </div>
      <p className="text-sm leading-6 text-muted-foreground">
        Inches. Tube: diameter is OD and thickness is wall. Round: diameter and
        length. Plate, sheet, and bar: thickness, width, and length. Block:
        length, width, and thickness. Leave the ones that don&apos;t apply blank.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Length (in)" name="lengthIn" error={state.errors.lengthIn}>
          <Input id="lengthIn" name="lengthIn" className={fieldClass} inputMode="decimal" defaultValue={values.lengthIn} />
        </Field>
        <Field label="Width (in)" name="widthIn" error={state.errors.widthIn}>
          <Input id="widthIn" name="widthIn" className={fieldClass} inputMode="decimal" defaultValue={values.widthIn} />
        </Field>
        <Field label="Thickness (in)" name="thicknessIn" error={state.errors.thicknessIn}>
          <Input id="thicknessIn" name="thicknessIn" className={fieldClass} inputMode="decimal" defaultValue={values.thicknessIn} />
        </Field>
        <Field label="Diameter (in)" name="diameterIn" error={state.errors.diameterIn}>
          <Input id="diameterIn" name="diameterIn" className={fieldClass} inputMode="decimal" defaultValue={values.diameterIn} />
        </Field>
        <Field
          label="Total weight (lb)"
          name="weightLbs"
          error={state.errors.weightLbs}
          hint="Optional. Weight of the whole lot."
        >
          <Input id="weightLbs" name="weightLbs" className={fieldClass} inputMode="decimal" defaultValue={values.weightLbs} />
        </Field>
        <Field label="Pickup ZIP" name="zip" error={state.errors.zip}>
          <Input
            id="zip"
            name="zip"
            className={fieldClass}
            inputMode="numeric"
            autoComplete="postal-code"
            defaultValue={values.zip || defaultZip}
            required
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <Field
          label="Lot price (USD)"
          name="price"
          error={state.errors.price}
          hint="What you want for everything in the lot."
        >
          <Input
            id="price"
            name="price"
            className={fieldClass}
            inputMode="decimal"
            defaultValue={values.price}
            placeholder="36"
          />
        </Field>
        <label className="flex h-11 items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            name="isFree"
            defaultChecked={values.isFree === "on"}
            className="size-4 accent-primary"
          />
          Free
        </label>
      </div>
      <Field label="Notes" name="notes" hint="Condition, hours, how to find the door.">
        <Textarea
          id="notes"
          name="notes"
          className="min-h-28 bg-card text-base md:text-base"
          defaultValue={values.notes}
        />
      </Field>
      <Field
        label="Photo"
        name="photo"
        error={state.errors.photo}
        hint="Optional. JPEG, PNG, or WebP, up to 3.5 MB."
      >
        <Input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" className="h-11 bg-card text-base" />
      </Field>
      <Button type="submit" className="h-11 px-4 text-base" disabled={pending}>
        {pending ? "Publishing…" : "Publish listing"}
      </Button>
    </form>
  );
}

function Select({
  id,
  name,
  defaultValue,
  options,
}: {
  id: string;
  name: string;
  defaultValue?: string;
  options: readonly { value: string; label: string }[];
}) {
  return (
    <select
      id={id}
      name={name}
      defaultValue={defaultValue}
      className="h-11 w-full rounded-lg border border-input bg-card px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
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
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
