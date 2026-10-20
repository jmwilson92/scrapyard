import { Suspense } from "react";
import { Marketplace } from "@/components/marketplace";
import { BoardFallback, Shell } from "@/components/shell";

export const metadata = { title: "Browse" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function BrowsePage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Shell>
      <Suspense fallback={<BoardFallback />}>
        <Marketplace searchParams={searchParams} />
      </Suspense>
    </Shell>
  );
}
