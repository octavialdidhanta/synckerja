import { ImageOff } from "lucide-react";
import { cn } from "@/shared/lib/utils";

type MobileSmpMediaThumbProps = {
  src?: string | null;
  title: string;
  variant?: "video" | "post";
};

export function MobileSmpMediaThumb({
  src,
  title,
  variant = "video",
}: MobileSmpMediaThumbProps) {
  const sizeClass = variant === "video" ? "h-10 w-8" : "h-10 w-10";

  return (
    <span className="inline-flex max-w-[14rem] min-w-0 items-center gap-2">
      {src ? (
        <img src={src} alt="" className={cn(sizeClass, "shrink-0 rounded object-cover")} />
      ) : (
        <span
          className={cn(
            sizeClass,
            "flex shrink-0 items-center justify-center rounded bg-muted text-muted-foreground",
          )}
          aria-hidden
        >
          <ImageOff className="h-3.5 w-3.5" />
        </span>
      )}
      <span className="truncate font-medium text-foreground" title={title}>
        {title}
      </span>
    </span>
  );
}
