import Link from "next/link";
import { Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <Shell>
      <h1 className="font-display text-5xl tracking-wide">Not on the board</h1>
      <p className="mt-3 max-w-md text-base leading-7 text-muted-foreground">
        That page or listing isn&apos;t here. It may have been deleted.
      </p>
      <Button nativeButton={false} render={<Link href="/browse" />} className="mt-6 h-11 px-4">
        Browse remnants
      </Button>
    </Shell>
  );
}
