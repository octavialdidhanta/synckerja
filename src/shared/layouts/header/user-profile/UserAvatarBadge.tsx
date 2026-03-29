import { useEffect, useState } from "react";
import { cn } from "@/shared/lib/utils";

const sizeMap = {
  sm: "h-9 w-9 text-[11px] font-semibold",
  md: "h-10 w-10 text-xs font-semibold",
  lg: "h-12 w-12 text-sm font-semibold",
} as const;

type UserAvatarBadgeProps = {
  initials: string;
  /** When set and load succeeds, shows photo instead of initials. */
  imageUrl?: string | null;
  size?: keyof typeof sizeMap;
  className?: string;
};

export function UserAvatarBadge({ initials, imageUrl, size = "md", className }: UserAvatarBadgeProps) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

  const showImage = Boolean(imageUrl) && !imageFailed;

  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-border",
        showImage ? "bg-muted" : "bg-muted font-semibold uppercase tracking-tight text-muted-foreground",
        sizeMap[size],
        className,
      )}
      aria-hidden
    >
      {showImage ? (
        <img
          src={imageUrl!}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        initials.slice(0, 2)
      )}
    </span>
  );
}
