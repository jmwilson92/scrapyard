"use client";

import { useActionState, useState } from "react";
import { createListingAction } from "@/app/actions/listings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LISTING_TYPES } from "@/lib/business";
import { CATEGORIES, FORMS, METAL_TYPES, subtypesFor } from "@/lib/constants";
import { emptyFormState } from "@/lib/form-state";

const fieldClass = "h-11 w-full rounded-xl bg-white text-base md:text-base";
const selectClass =
  "h-11 w-full rounded-xl border border-input bg-white px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function ListingForm({
  defaultZip,
  defaultType = "offer",
}: {
  defaultZip: string;
  defaultType?: "offer" | "wanted";
}) {
  const [state, action, pending] = useActionState(createListingAction, {
    ...emptyFormState,
    values: { listingType: defaultType, zip: defaultZip, quantity: "1", category: "metal", metalType: "al-6061", form: "bar-round", deliveryMode: "pickup" },
  });
  const values = state.values;
  const [category, setCategory] = useState(values.category || "metal");
  const [listingType, setListingType] = useState(values.listingType || defaultType);
  const isWanted = listingType === "wanted";
  const isMetal = category === "metal";
  const subtypes = isMetal ? [] : subtypesFor(category);

  return (
    <form action={action} className="grid gap-4">
      {state.formError ? (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.formError}
        </p>
      ) : null}
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">Post type</legend>
        <div className="grid grid-cols-2 gap-2">
          {LISTING_TYPES.map((option) => (
            <label
              key={option.value}
              className={
                listingType === option.value
                  ? "flex min-h-11 items-center gap-2 rounded-xl border-2 border-primary bg-white px-3 text-sm font-semibold"
                  : "flex min-h-11 items-center gap-2 rounded-xl border border-input bg-white px-3 text-sm"
              }
            >
              <input
                type="radio"
                name="listingType"
                value={option.value}
                checked={listingType === option.value}
                onChange={() => setListingType(option.value)}
                className="size-4 accent-primary"
              />
              {option.value === "offer" ? "Selling" : "Wanted"}
            </label>
          ))}
        </div>
        {state.errors.listingType ? (
          <p className="text-sm text-destructive">{state.errors.listingType}</p>
        ) : null}
        <p className="text-sm text-neutral-500">
          {isWanted
            ? "Tell suppliers what your business needs. They reply in your inbox with what they have."
            : "Offer surplus, scrap, or remnant material to other businesses."}
        </p>
      </fieldset>
      <Field label="Title" name="title" error={state.errors.title}>
        <Input
          id="title"
          name="title"
          className={fieldClass}
          defaultValue={values.title}
          placeholder={
            isWanted
              ? "Need: 1/2 in 6061 plate, 12 x 12 or larger"
              : isMetal
                ? "6061-T6 plate drops, half inch"
                : "2x6 lumber offcuts, 3 to 6 ft"
          }
          required
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category" name="category" error={state.errors.category}>
          <select
            id="category"
            name="category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className={selectClass}
          >
            {CATEGORIES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        {isMetal ? (
          <Field label="Metal type" name="metalType" error={state.errors.metalType}>
            <Select
              id="metalType"
              name="metalType"
              defaultValue={values.metalType || "al-6061"}
              options={METAL_TYPES}
            />
          </Field>
        ) : (
          <Field label="Type" name="subtype" error={state.errors.subtype}>
            <Select
              key={category}
              id="subtype"
              name="subtype"
              defaultValue={
                subtypes.some((item) => item.value === values.subtype)
                  ? values.subtype
                  : subtypes[0]?.value
              }
              options={subtypes}
            />
          </Field>
        )}
        <Field
          label={isMetal ? "Alloy or grade" : "Spec or grade (optional)"}
          name="alloy"
          error={state.errors.alloy}
        >
          <Input
            id="alloy"
            name="alloy"
            className={fieldClass}
            defaultValue={values.alloy}
            placeholder={isMetal ? "6061-T6" : "Doug fir #2, 1/2 in regular, 12/2 NM-B"}
            required={isMetal}
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
        {isMetal ? "" : "Optional for non-metal lots. "}Inches. Plate and sheet: thickness, width, and length. Bar and round: diameter or thickness, plus length. Tube and pipe: diameter is OD, thickness is wall. Angle: leg width and thickness. Leave the ones that don&apos;t apply blank.
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
        <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
          <input
            type="radio"
            name="deliveryMode"
            value="pickup"
            defaultChecked={values.deliveryMode !== "delivery"}
            className="size-4 accent-primary"
          />
          Buyer pickup only
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
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
          label={isWanted ? "Target budget (USD, optional)" : "Lot price (USD)"}
          name="price"
          error={state.errors.price}
          hint={
            isWanted
              ? "Leave blank to take quotes."
              : "What you want for everything in the lot."
          }
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
        {isWanted ? null : (
          <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              name="isFree"
              defaultChecked={values.isFree === "on"}
              className="size-4 accent-primary"
            />
            Free
          </label>
        )}
      </div>
      {isMetal ? (
      <fieldset className="grid gap-3 rounded-2xl border border-neutral-200 p-4">
        <legend className="px-1 text-sm font-semibold">Material certifications</legend>
        <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
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
      ) : null}
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
      className={selectClass}
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
