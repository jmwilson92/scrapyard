"use client";

import { useActionState } from "react";
import { postOrderUpdateAction } from "@/app/actions/orders";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ATTACHMENT_ACCEPT } from "@/lib/attachments";
import { emptyFormState } from "@/lib/form-state";
import { ORDER_STAGES, stageIndex } from "@/lib/order-stages";

export function OrderUpdateForm({ orderId, stage }: { orderId: string; stage: string }) {
  const [state, action, pending] = useActionState(postOrderUpdateAction, emptyFormState);
  const current = stageIndex(stage);
  const nextDefault = ORDER_STAGES[Math.min(current + 1, ORDER_STAGES.length - 1)].value;
  return (
    <form action={action} className="grid gap-3" key={state.success ?? "form"}>
      <input type="hidden" name="orderId" value={orderId} />
      {state.success ? <p role="status" className="text-sm text-primary">{state.success}</p> : null}
      {state.formError ? <p role="alert" className="text-sm text-destructive">{state.formError}</p> : null}
      <label className="grid gap-1.5 text-sm font-medium">
        Stage
        <select
          name="stage"
          defaultValue={state.values.stage || nextDefault}
          className="h-11 w-full rounded-xl border border-input bg-white px-3 text-base"
        >
          {ORDER_STAGES.map((item, index) =>
            index < current ? null : (
              <option key={item.value} value={item.value}>
                {item.label}
                {index === current ? " (current, add a note)" : ""}
              </option>
            ),
          )}
        </select>
        {state.errors.stage ? <span className="text-destructive">{state.errors.stage}</span> : null}
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Note (optional)
        <Textarea
          name="note"
          maxLength={1000}
          defaultValue={state.values.note}
          placeholder="Plate cut, sent to waterjet. On track for Friday."
          className="min-h-20 bg-white text-base md:text-base"
        />
        {state.errors.note ? <span className="text-destructive">{state.errors.note}</span> : null}
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Photo or file (optional)
        <input
          name="file"
          type="file"
          accept={ATTACHMENT_ACCEPT}
          className="min-h-11 w-full rounded-xl border border-input bg-white px-3 py-2 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-neutral-100 file:px-3 file:py-1.5 file:text-sm file:font-semibold"
        />
        <span className="font-normal text-neutral-500">Only you and the buyer can open it. No controlled or confidential files.</span>
        {state.errors.file ? <span className="text-destructive">{state.errors.file}</span> : null}
      </label>
      <Button type="submit" className="h-11 px-4 text-base sm:w-auto" disabled={pending}>
        {pending ? "Posting…" : "Post update"}
      </Button>
    </form>
  );
}
