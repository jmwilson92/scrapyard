export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      {children}
    </div>
  );
}

export function BoardFallback() {
  return (
    <div className="grid gap-4" aria-hidden>
      <div className="h-28 animate-pulse rounded-xl bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-52 animate-pulse rounded-xl bg-muted" />
        <div className="h-52 animate-pulse rounded-xl bg-muted" />
      </div>
    </div>
  );
}
