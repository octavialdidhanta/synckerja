import { type ReactNode } from "react";
import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { Label } from "@/shared/components/ui/label";
import { cn } from "@/shared/lib/utils";

type Props = {
  content: ReactNode;
  ariaLabel?: string;
  className?: string;
  side?: "top" | "right" | "bottom" | "left";
};

/** Circular (i) — click to read; works in dialogs and dense sidebars. */
export function FormInfoHint({
  content,
  ariaLabel = "Info",
  className,
  side = "top",
}: Props) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          tabIndex={-1}
          aria-label={ariaLabel}
          className={cn(
            "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-muted-foreground/30 bg-muted/60 hover:bg-muted transition-colors",
            className,
          )}
        >
          <Info className="h-2.5 w-2.5 text-muted-foreground" strokeWidth={2.5} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align="start"
        className="z-[60] max-w-[280px] text-xs leading-relaxed"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {content}
      </PopoverContent>
    </Popover>
  );
}

type FieldLabelProps = {
  htmlFor?: string;
  label: string;
  labelClassName?: string;
  info?: ReactNode;
  infoAriaLabel?: string;
};

export function FormFieldLabel({
  htmlFor,
  label,
  labelClassName,
  info,
  infoAriaLabel,
}: FieldLabelProps) {
  return (
    <div className="flex items-center gap-1.5">
      <Label htmlFor={htmlFor} className={cn("text-sm font-medium", labelClassName)}>
        {label}
      </Label>
      {info ? <FormInfoHint content={info} ariaLabel={infoAriaLabel} /> : null}
    </div>
  );
}
