"use client";

import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button type="button" variant="outline" className="h-11 bg-card px-4" onClick={() => window.print()}>
      Print or save as PDF
    </Button>
  );
}
