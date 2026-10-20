"use client";

import dynamic from "next/dynamic";
import type { ShopPin } from "@/lib/shops";

const ShopMap = dynamic(() => import("@/components/shop-map"), {
  ssr: false,
  loading: () => <div className="h-[min(70vh,640px)] animate-pulse rounded-2xl bg-neutral-100" />,
});

export function ShopMapView({ pins }: { pins: ShopPin[] }) {
  return <ShopMap pins={pins} />;
}
