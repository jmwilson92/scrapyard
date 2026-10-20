export function VerifiedSellerBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-neutral-900 px-2 py-0.5 text-xs font-semibold text-white">
      Verified Seller
    </span>
  );
}

export function VerifiedSellerPlaceholder() {
  return (
    <div className="grid gap-1">
      <button
        type="button"
        disabled
        aria-disabled="true"
        className="inline-flex w-fit cursor-not-allowed items-center rounded-full border border-neutral-300 bg-neutral-100 px-3 py-1.5 text-sm font-semibold text-neutral-400"
      >
        Verified Seller · $1
      </button>
      <p className="text-xs text-neutral-500">
        Coming soon. Posting and browsing stay free. Skrappily does not take payment yet.
      </p>
    </div>
  );
}
