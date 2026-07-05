import { forwardRef } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/shared/lib/utils";

type FlowBuilderPillFilterTriggerProps = React.ComponentPropsWithoutRef<"button"> & {
  label: string;
  open?: boolean;
  trailingIcon?: React.ReactNode;
};

export const FlowBuilderPillFilterTrigger = forwardRef<HTMLButtonElement, FlowBuilderPillFilterTriggerProps>(
  function FlowBuilderPillFilterTrigger(
    { label, open = false, trailingIcon, className, type = "button", ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex h-9 max-w-full items-center gap-1.5 rounded-full border px-3 text-sm font-normal transition-colors",
          open
            ? "border-primary text-foreground"
            : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
          className,
        )}
        {...props}
      >
        <span className="truncate">{label}</span>
        {trailingIcon ?? (
          <ChevronDown
            className={cn("h-4 w-4 shrink-0 opacity-60 transition-transform", open && "rotate-180")}
            aria-hidden
          />
        )}
      </button>
    );
  },
);
