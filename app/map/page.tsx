import { Suspense } from "react";
import { Marketplace } from "@/components/marketplace";
import { BoardFallback, Shell } from "@/components/shell";

export const metadata = { title: "Map" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function MapPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Shell>
      <Suspense fallback={<BoardFallback />}>
        <Marketplace searchParams={searchParams} forcedView="map" />
      </Suspense>
    </Shell>
  );
}
