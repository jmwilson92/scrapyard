"use client";

import { useActionState, useState } from "react";
import { createRfqAction, sendRfqMessageAction, signNdaAction, submitQuoteAction, updateRfqAction } from "@/app/actions/rfqs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ATTACHMENT_ACCEPT, ATTACHMENT_HELP } from "@/lib/attachments";
import { CATEGORIES, subtypesFor } from "@/lib/constants";
import { emptyFormState, type FormState } from "@/lib/form-state";
import { UNITS } from "@/lib/rfq";
import { DEFAULT_NDA_MODE, NDA_DISCLAIMER } from "@/lib/nda";

const fieldClass = "h-11 w-full rounded-xl bg-white text-base md:text-base";
const selectClass =
  "h-11 w-full rounded-xl border border-input bg-white px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function AttachmentWarning({ audience }: { audience: "rfq" | "quote" }) {
  return (
    <div
      role="note"
      className="rounded-xl border-2 border-amber-400 bg-amber-50 px-3 py-2.5 text-sm leading-6 text-amber-950"
    >
      <p className="font-semibold">Before you attach anything</p>
      <p>
        Don&apos;t upload sensitive, ITAR or export-controlled (EAR), proprietary, or
        confidential files, or anything under an NDA.{" "}
        {audience === "rfq"
          ? "Without an NDA, RFQ attachments are visible to every signed-in business on Skrappily. With an NDA, businesses must sign it before they can open them."
          : "Quote attachments are visible to the RFQ owner and your company."}{" "}
        Share controlled drawings directly with a vetted supplier instead.
      </p>
    </div>
  );
}

function Attachments({ max, error }: { max: number; error?: string }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor="attachments">Attachments (optional, up to {max})</Label>
      <input
        id="attachments"
        name="attachments"
        type="file"
        multiple={max > 1}
        accept={ATTACHMENT_ACCEPT}
        className="min-h-11 w-full rounded-xl border border-input bg-white px-3 py-2 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-neutral-100 file:px-3 file:py-1.5 file:text-sm file:font-semibold"
      />
      <p className="text-sm text-neutral-500">{ATTACHMENT_HELP}</p>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

export type EditableFile = { id: string; name: string; revLabel: string };

export function RfqForm({
  defaultZip,
  today,
  edit,
}: {
  defaultZip: string;
  today: string;
  edit?: { rfqId: string; values: Record<string, string>; files: EditableFile[]; ndaFileName?: string | null };
}) {
  const [state, action, pending] = useActionState(edit ? updateRfqAction : createRfqAction, {
    ...emptyFormState,
    values: edit?.values ?? { deliveryZip: defaultZip, category: "metal", unit: "pcs" },
  });
  const v = state.values;
  const e = state.errors;
  const [category, setCategory] = useState(v.category || "metal");
  const subtypes = subtypesFor(category);

  // Remount after each failed submit so selects keep the values that were sent.
  return (
    <form key={formKey(state)} action={action} className="grid gap-4">
      <FormMessages state={state} />
      {edit ? <input type="hidden" name="rfqId" value={edit.rfqId} /> : null}
      <Field label="RFQ title" name="title" error={e.title}>
        <Input id="title" name="title" className={fieldClass} defaultValue={v.title}
          placeholder="1/2 in 6061-T6 plate, 24 x 48, qty 10" required />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Material category" name="category" error={e.category}>
          <select id="category" name="category" value={category}
            onChange={(event) => setCategory(event.target.value)} className={selectClass}>
            {CATEGORIES.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Material type" name="subtype" error={e.subtype}>
          <select key={category} id="subtype" name="subtype" className={selectClass}
            defaultValue={subtypes.some((s) => s.value === v.subtype) ? v.subtype : subtypes[0]?.value}>
            {subtypes.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Quantity" name="quantity" error={e.quantity}>
          <Input id="quantity" name="quantity" inputMode="decimal" className={fieldClass}
            defaultValue={v.quantity} placeholder="10" required />
        </Field>
        <Field label="Unit" name="unit" error={e.unit}>
          <select id="unit" name="unit" defaultValue={v.unit || "pcs"} className={selectClass}>
            {UNITS.map((unit) => (
              <option key={unit.value} value={unit.value}>{unit.label}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Specs" name="specs" error={e.specs}
        hint="Grade, dimensions, tolerances, finish, certs needed (MTR, CoC), packaging.">
        <Textarea id="specs" name="specs" defaultValue={v.specs} required
          className="min-h-32 bg-white text-base md:text-base" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Needed by (optional)" name="neededBy" error={e.neededBy}>
          <Input id="neededBy" name="neededBy" type="date" min={today} className={fieldClass} defaultValue={v.neededBy} />
        </Field>
        <Field label="Quotes due (RFQ expires)" name="expiresOn" error={e.expiresOn} hint="Defaults to 14 days.">
          <Input id="expiresOn" name="expiresOn" type="date" min={today} className={fieldClass} defaultValue={v.expiresOn} />
        </Field>
        <Field label="Delivery ZIP" name="deliveryZip" error={e.deliveryZip}>
          <Input id="deliveryZip" name="deliveryZip" inputMode="numeric" className={fieldClass}
            defaultValue={v.deliveryZip} required />
        </Field>
        <Field label="Delivery location / notes (optional)" name="deliveryLocation" error={e.deliveryLocation}>
          <Input id="deliveryLocation" name="deliveryLocation" className={fieldClass}
            defaultValue={v.deliveryLocation} placeholder="Dock 2, Kearny Mesa. Liftgate needed." />
        </Field>
        <Field label="Target budget, USD (optional)" name="budget" error={e.budget} hint="Leave blank to take quotes.">
          <Input id="budget" name="budget" inputMode="decimal" className={fieldClass} defaultValue={v.budget} />
        </Field>
      </div>
      <NdaPicker initial={v.ndaMode || DEFAULT_NDA_MODE} error={e.ndaFile} currentFileName={edit?.ndaFileName ?? null} editing={Boolean(edit)} />
      <AttachmentWarning audience="rfq" />
      {edit && edit.files.length > 0 ? (
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">Current drawings and files</legend>
          {edit.files.map((file) => (
            <div key={file.id} className="grid gap-2 rounded-xl border border-neutral-200 bg-white p-3 text-sm">
              <p className="font-semibold break-all">
                {file.name} <span className="font-normal text-neutral-500">· {file.revLabel}</span>
              </p>
              <label className="grid gap-1">
                <span className="text-neutral-600">Upload a new revision (old one stays in History)</span>
                <input name={`replace-${file.id}`} type="file" accept={ATTACHMENT_ACCEPT}
                  className="min-h-11 w-full rounded-xl border border-input bg-white px-3 py-2 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-neutral-100 file:px-3 file:py-1.5 file:text-sm file:font-semibold" />
              </label>
              <label className="flex min-h-11 items-center gap-2">
                <input type="checkbox" name="removeFile" value={file.id} className="size-4 accent-primary" />
                Remove this file
              </label>
            </div>
          ))}
        </fieldset>
      ) : null}
      <Attachments max={5} error={e.attachments} />
      <label className="flex min-h-11 items-start gap-2 text-sm">
        <input type="checkbox" name="acknowledge" required={!edit} className="mt-1 size-4 accent-primary" />
        <span>
          These files contain no export-controlled, proprietary, or confidential information, and I&apos;m OK with
          signed-in businesses seeing them.
        </span>
      </label>
      {e.acknowledge ? <p className="text-sm text-destructive">{e.acknowledge}</p> : null}
      <Button type="submit" className="h-11 px-4 text-base" disabled={pending}>
        {edit ? (pending ? "Saving…" : "Save changes") : pending ? "Posting…" : "Post RFQ"}
      </Button>
    </form>
  );
}

const NDA_OPTIONS = [
  { value: "template", label: "Skrappily standard NDA", hint: "Mutual NDA filled in with both business names and this RFQ." },
  { value: "custom", label: "Upload our own NDA", hint: "PDF. Quoters read it and e-sign before seeing files." },
  { value: "none", label: "None", hint: "Any signed-in business can open the attachments." },
];

function NdaPicker({ initial, error, currentFileName, editing }: {
  initial: string;
  error?: string;
  currentFileName: string | null;
  editing: boolean;
}) {
  const [mode, setMode] = useState(initial);
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-medium">NDA for quoters</legend>
      <p className="text-sm text-neutral-500">
        With an NDA, other businesses must sign it before they can open your files or send a quote.
        {editing ? " Changing or replacing it makes everyone who already signed re-sign." : ""}
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        {NDA_OPTIONS.map((option) => (
          <label key={option.value}
            className={`flex min-h-11 cursor-pointer items-start gap-2 rounded-xl border bg-white p-3 text-sm ${mode === option.value ? "border-primary" : "border-neutral-200"}`}>
            <input type="radio" name="ndaMode" value={option.value} checked={mode === option.value}
              onChange={() => setMode(option.value)} className="mt-1 size-4 accent-primary" />
            <span>
              <span className="font-semibold">{option.label}</span>
              <span className="block text-neutral-500">{option.hint}</span>
            </span>
          </label>
        ))}
      </div>
      {mode === "custom" ? (
        <label className="grid gap-1 text-sm">
          <span className="text-neutral-600">
            {currentFileName ? `Current NDA: ${currentFileName}. Upload a new PDF to replace it (optional).` : "Your NDA (PDF)"}
          </span>
          <input name="ndaFile" type="file" accept=".pdf,application/pdf" required={!currentFileName}
            className="min-h-11 w-full rounded-xl border border-input bg-white px-3 py-2 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-neutral-100 file:px-3 file:py-1.5 file:text-sm file:font-semibold" />
        </label>
      ) : null}
      {mode === "template" ? <p className="text-xs text-neutral-500">{NDA_DISCLAIMER}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </fieldset>
  );
}

export function NdaSignForm({ rfqId, ndaRevision, businessName }: { rfqId: string; ndaRevision: number; businessName: string }) {
  const [state, action, pending] = useActionState(signNdaAction, emptyFormState);
  const v = state.values;
  const e = state.errors;
  return (
    <form action={action} className="grid gap-4">
      <FormMessages state={state} />
      <input type="hidden" name="rfqId" value={rfqId} />
      <input type="hidden" name="ndaRevision" value={ndaRevision} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full legal name" name="signerName" error={e.signerName}>
          <Input id="signerName" name="signerName" autoComplete="name" className={fieldClass} defaultValue={v.signerName} required />
        </Field>
        <Field label="Title" name="signerTitle" error={e.signerTitle}>
          <Input id="signerTitle" name="signerTitle" autoComplete="organization-title" className={fieldClass}
            defaultValue={v.signerTitle} placeholder="Owner, Purchasing Manager" required />
        </Field>
      </div>
      <label className="flex min-h-11 items-start gap-2 text-sm">
        <input type="checkbox" name="agree" required className="mt-1 size-4 accent-primary" />
        <span>I agree to this NDA on behalf of <strong>{businessName}</strong> and I&apos;m authorized to bind it. My typed name is my electronic signature.</span>
      </label>
      {e.agree ? <p className="text-sm text-destructive">{e.agree}</p> : null}
      <Button type="submit" className="h-11 px-4 text-base" disabled={pending}>
        {pending ? "Signing…" : "Sign NDA and unlock files"}
      </Button>
    </form>
  );
}

export function QuoteForm({ rfqId, defaultQuantity, unit }: { rfqId: string; defaultQuantity: number; unit: string }) {
  const [state, action, pending] = useActionState(submitQuoteAction, {
    ...emptyFormState,
    values: { quantity: String(defaultQuantity), priceBasis: "total" },
  });
  const v = state.values;
  const e = state.errors;
  if (state.success) {
    return <p role="status" className="text-sm font-semibold text-primary">{state.success}</p>;
  }
  return (
    <form key={formKey(state)} action={action} className="grid gap-4">
      <input type="hidden" name="rfqId" value={rfqId} />
      <FormMessages state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Price, USD" name="price" error={e.price}>
          <Input id="price" name="price" inputMode="decimal" className={fieldClass} defaultValue={v.price} required />
        </Field>
        <Field label="Price is" name="priceBasis" error={e.priceBasis}>
          <select id="priceBasis" name="priceBasis" defaultValue={v.priceBasis || "total"} className={selectClass}>
            <option value="total">Total for the quantity</option>
            <option value="per-unit">Per unit ({unit})</option>
          </select>
        </Field>
        <Field label={`Quantity you can supply (${unit})`} name="quantity" error={e.quantity}>
          <Input id="quantity" name="quantity" inputMode="decimal" className={fieldClass} defaultValue={v.quantity} required />
        </Field>
        <Field label="Lead time, days" name="leadTimeDays" error={e.leadTimeDays}>
          <Input id="leadTimeDays" name="leadTimeDays" inputMode="numeric" className={fieldClass}
            defaultValue={v.leadTimeDays} placeholder="5" required />
        </Field>
        <Field label="Quote valid until" name="validUntil" error={e.validUntil} hint="Defaults to 14 days.">
          <Input id="validUntil" name="validUntil" type="date" className={fieldClass} defaultValue={v.validUntil} />
        </Field>
      </div>
      <Field label="Notes (optional)" name="notes" error={e.notes} hint="Material source, certs, delivery terms, exceptions.">
        <Textarea id="notes" name="notes" defaultValue={v.notes} className="min-h-24 bg-white text-base md:text-base" />
      </Field>
      <AttachmentWarning audience="quote" />
      <Attachments max={2} error={e.attachments} />
      <Button type="submit" className="h-11 px-4 text-base" disabled={pending}>
        {pending ? "Sending quote…" : "Submit quote"}
      </Button>
    </form>
  );
}

export function RfqMessageForm({ rfqId, recipientId, label = "Message this business" }: {
  rfqId: string;
  recipientId: string;
  label?: string;
}) {
  const [state, action, pending] = useActionState(sendRfqMessageAction, emptyFormState);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="rfqId" value={rfqId} />
      <input type="hidden" name="recipientId" value={recipientId} />
      <div className="grid gap-1.5">
        <Label htmlFor={`body-${rfqId}-${recipientId}`}>{label}</Label>
        <Textarea id={`body-${rfqId}-${recipientId}`} name="body" required defaultValue={state.values.body}
          className="min-h-28 bg-card text-base md:text-base" aria-invalid={Boolean(state.errors.body)} />
        {state.errors.body ? <p className="text-sm text-destructive">{state.errors.body}</p> : null}
      </div>
      {state.formError ? <p role="alert" className="text-sm text-destructive">{state.formError}</p> : null}
      <Button type="submit" className="h-11 px-4 text-base" disabled={pending}>
        {pending ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}

function formKey(state: FormState): string {
  return JSON.stringify([state.values, state.errors, state.formError]);
}

function FormMessages({ state }: { state: FormState }) {
  if (!state.formError) return null;
  return <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{state.formError}</p>;
}

function Field({ label, name, error, hint, children }: {
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
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
