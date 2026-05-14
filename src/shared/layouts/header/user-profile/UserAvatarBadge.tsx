import { useEffect, useState } from "react";
import { User } from "lucide-react";
import { cn } from "@/shared/lib/utils";

const sizeMap = {
  sm: "h-9 w-9 text-[11px] font-semibold",
  md: "h-10 w-10 text-xs font-semibold",
  lg: "h-12 w-12 text-sm font-semibold",
} as const;

const iconSizeMap = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
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
        <User className={cn("text-muted-foreground", iconSizeMap[size])} strokeWidth={2} aria-hidden />
      )}
    </span>
  );
}
