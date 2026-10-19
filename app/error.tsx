"use client";

import { Button } from "@/components/ui/button";
import { Shell } from "@/components/shell";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Shell>
      <h1 className="font-display text-5xl tracking-wide">The board hit a snag</h1>
      <p className="mt-3 max-w-lg text-base leading-7 text-muted-foreground">
        {error.message || "Try loading this page again."}
      </p>
      <Button type="button" onClick={reset} className="mt-6 h-11 px-4">
        Try again
      </Button>
    </Shell>
  );
}
