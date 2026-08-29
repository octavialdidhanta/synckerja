import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { cn } from "@/shared/lib/utils";

type Props = {
  label: string;
  tooltip?: string;
  align?: "left" | "right" | "center";
  active?: boolean;
  dir?: "asc" | "desc";
  onClick?: () => void;
  sortable?: boolean;
};

export function ItemSalesColumnHeader({
  label,
  tooltip,
  align = "left",
  active,
  dir,
  onClick,
  sortable = true,
}: Props) {
  const content = (
    <>
      <span>{label}</span>
      {tooltip ? (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="ml-1 inline-flex text-muted-foreground hover:text-foreground"
                onClick={(e) => e.stopPropagation()}
                aria-label={tooltip}
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">
              {tooltip}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : null}
    </>
  );

  if (!sortable || !onClick) {
    return (
      <span
        className={cn(
        "inline-flex items-center font-medium uppercase tracking-wide",
        align === "right" && "justify-end",
        align === "center" && "justify-center",
        )}
      >
        {content}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex w-full items-center font-medium uppercase tracking-wide",
        align === "right" && "justify-end",
        align === "center" && "justify-center",
      )}
    >
      {content}
      {active ? (
        <span className="ml-1 text-[10px] opacity-70" aria-hidden>
          {dir === "asc" ? "↑" : "↓"}
        </span>
      ) : null}
    </button>
  );
}
