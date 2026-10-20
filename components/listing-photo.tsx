import { cn } from "cn";

export function ListingPhoto({
  src,
  alt,
  className,
}: {
  src: string | null;
  alt: string;
  className?: string;
}) {
  return (
    <div className={cn("relative aspect-square overflow-hidden bg-neutral-100", className)}>
      {src ? (
        // User and seed photos are same-origin files or arbitrary blob URLs.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="flex h-full items-center justify-center px-4 text-center text-sm font-medium text-neutral-500">
          No photo
        </div>
      )}
    </div>
  );
}
