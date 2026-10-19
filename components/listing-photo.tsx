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
    <div
      className={cn(
        "relative aspect-[4/3] overflow-hidden bg-muted",
        className,
      )}
    >
      {src ? (
        // User and seed photos are same-origin files or arbitrary blob URLs.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full items-center justify-center px-4 text-center">
          <span className="font-display text-2xl tracking-wide text-muted-foreground">
            No photo
          </span>
        </div>
      )}
    </div>
  );
}
