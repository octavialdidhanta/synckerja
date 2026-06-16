import { type ReactNode } from "react";
import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { cn } from "@/shared/lib/utils";

type ClickInfoHintProps = {
  content: ReactNode;
  iconClassName?: string;
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
};

/** Info hint opened on click — avoids Radix Tooltip auto-open on dialog focus. */
export function ClickInfoHint({
  content,
  iconClassName,
  align = "start",
  side = "bottom",
}: ClickInfoHintProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          tabIndex={-1}
          className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted hover:bg-muted/80 transition-colors"
          aria-label="Info"
        >
          <Info className={cn("h-3 w-3 text-muted-foreground", iconClassName)} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        className="z-[60] max-w-xs text-sm leading-relaxed"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {content}
      </PopoverContent>
    </Popover>
  );
}
