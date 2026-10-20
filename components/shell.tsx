export function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-6">{children}</div>;
}

export function BoardFallback() {
  return (
    <div className="grid gap-4" aria-hidden>
      <div className="h-10 animate-pulse rounded-full bg-neutral-100" />
      <div className="h-28 animate-pulse rounded-2xl bg-neutral-100" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="h-64 animate-pulse rounded-2xl bg-neutral-100" />
        <div className="h-64 animate-pulse rounded-2xl bg-neutral-100" />
        <div className="h-64 animate-pulse rounded-2xl bg-neutral-100" />
        <div className="h-64 animate-pulse rounded-2xl bg-neutral-100" />
      </div>
    </div>
  );
}
