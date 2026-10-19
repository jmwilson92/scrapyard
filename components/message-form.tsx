"use client";

import { useActionState } from "react";
import { sendMessageAction } from "@/app/actions/messages";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { emptyFormState } from "@/lib/form-state";

export function MessageForm({
  listingId,
  recipientId,
  label = "Message the seller",
}: {
  listingId: string;
  recipientId?: string;
  label?: string;
}) {
  const [state, action, pending] = useActionState(sendMessageAction, emptyFormState);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="listingId" value={listingId} />
      {recipientId ? (
        <input type="hidden" name="recipientId" value={recipientId} />
      ) : null}
      <div className="grid gap-1.5">
        <Label htmlFor={`body-${listingId}`}>{label}</Label>
        <Textarea
          id={`body-${listingId}`}
          name="body"
          required
          defaultValue={state.values.body}
          placeholder="I can pick up Thursday morning. Is the lot still there?"
          className="min-h-28 bg-card text-base md:text-base"
          aria-invalid={Boolean(state.errors.body)}
        />
        {state.errors.body ? (
          <p className="text-sm text-destructive">{state.errors.body}</p>
        ) : null}
      </div>
      {state.formError ? (
        <p role="alert" className="text-sm text-destructive">
          {state.formError}
        </p>
      ) : null}
      <Button type="submit" className="h-11 px-4 text-base" disabled={pending}>
        {pending ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}
