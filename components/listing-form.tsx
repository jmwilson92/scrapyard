"use client";

import { useActionState } from "react";
import { createListingAction } from "@/app/actions/listings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FORMS, METAL_TYPES } from "@/lib/constants";
import { emptyFormState } from "@/lib/form-state";

const fieldClass = "h-11 rounded-xl bg-white text-base md:text-base";

export function ListingForm({ defaultZip }: { defaultZip: string }) {
  const [state, action, pending] = useActionState(createListingAction, {
    ...emptyFormState,
    values: { zip: defaultZip, quantity: "1", metalType: "al-6061", form: "bar-round", deliveryMode: "pickup" },
  });
  const values = state.values;

  return (
    <form action={action} className="grid gap-4">
      {state.formError ? (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
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
        <Field label="Metal type" name="metalType" error={state.errors.metalType}>
          <Select
            id="metalType"
            name="metalType"
            defaultValue={values.metalType || "al-6061"}
            options={METAL_TYPES}
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
          <Select id="form" name="form" defaultValue={values.form || "bar-round"} options={FORMS} />
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
      <p className="text-sm leading-6 text-neutral-500">
        Inches. Plate and sheet: thickness, width, and length. Bar and round: diameter or thickness, plus length. Tube and pipe: diameter is OD, thickness is wall. Angle: leg width and thickness. Leave the ones that don&apos;t apply blank.
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
      <fieldset className="grid gap-3 rounded-2xl border border-neutral-200 p-4">
        <legend className="px-1 text-sm font-semibold">Delivery</legend>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="radio"
            name="deliveryMode"
            value="pickup"
            defaultChecked={values.deliveryMode !== "delivery"}
            className="size-4 accent-primary"
          />
          Buyer pickup only
        </label>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="radio"
            name="deliveryMode"
            value="delivery"
            defaultChecked={values.deliveryMode === "delivery"}
            className="size-4 accent-primary"
          />
          Seller can deliver
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Delivery radius (miles)"
            name="deliveryRadius"
            error={state.errors.deliveryRadius}
            hint="Optional. How far you'll drive."
          >
            <Input
              id="deliveryRadius"
              name="deliveryRadius"
              className={fieldClass}
              inputMode="numeric"
              defaultValue={values.deliveryRadius}
              placeholder="25"
            />
          </Field>
          <Field
            label="Delivery fee (USD)"
            name="deliveryFee"
            error={state.errors.deliveryFee}
            hint="Optional. Leave blank if you'll quote it. Not charged here."
          >
            <Input
              id="deliveryFee"
              name="deliveryFee"
              className={fieldClass}
              inputMode="decimal"
              defaultValue={values.deliveryFee}
              placeholder="25"
            />
          </Field>
        </div>
      </fieldset>
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
      <fieldset className="grid gap-3 rounded-2xl border border-neutral-200 p-4">
        <legend className="px-1 text-sm font-semibold">Material certifications</legend>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            name="certsAvailable"
            defaultChecked={values.certsAvailable === "on" || values.certsAvailable === "1"}
            className="size-4 accent-primary"
          />
          Material certs available
        </label>
        <Field
          label="Cert note"
          name="certsNote"
          error={state.errors.certsNote}
          hint="Optional. Mill test report or certificate of conformance. Buyers ask to see it in person."
        >
          <Textarea
            id="certsNote"
            name="certsNote"
            className="min-h-20 rounded-xl bg-white text-base md:text-base"
            defaultValue={values.certsNote}
            placeholder="MTR from the service center, heat number on the paperwork."
          />
        </Field>
      </fieldset>
      <Field label="Notes" name="notes" hint="Condition, hours, how to find the door.">
        <Textarea
          id="notes"
          name="notes"
          className="min-h-28 rounded-xl bg-white text-base md:text-base"
          defaultValue={values.notes}
        />
      </Field>
      <Field
        label="Photo"
        name="photo"
        error={state.errors.photo}
        hint="Optional. JPEG, PNG, or WebP, up to 3.5 MB."
      >
        <Input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" className="h-11 rounded-xl bg-white text-base" />
      </Field>
      <Button type="submit" className="h-11 rounded-full px-4 text-base" disabled={pending}>
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
      className="h-11 w-full rounded-xl border border-input bg-white px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
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
      {hint ? <p className="text-sm text-neutral-500">{hint}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
