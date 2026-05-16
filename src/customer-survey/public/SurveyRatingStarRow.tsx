import { Star } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/utils";

type Props = {
  value: number | null;
  onChange: (rating: number) => void;
  minLabel: string;
  maxLabel: string;
  compact?: boolean;
  /** When true, clicks are ignored (illustration only). */
  disabled?: boolean;
};

export function SurveyRatingStarRow({ value, onChange, minLabel, maxLabel, compact, disabled }: Props) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
        <div className={cn("flex gap-1 sm:gap-1.5", "justify-between")}>
          {([1, 2, 3, 4, 5] as const).map((n) => {
            const selected = value === n;
            const filled = value != null && n <= value;
            return (
              <button
                key={n}
                type="button"
                disabled={disabled}
                onClick={() => !disabled && onChange(n)}
                className={cn(
                  "flex min-w-0 flex-1 items-center justify-center rounded-lg border-2 transition-colors",
                  compact ? "min-h-[2.5rem] py-2" : "min-h-[3rem] py-2.5",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  selected
                    ? "border-primary bg-primary/10 shadow-sm"
                    : "border-border bg-muted/30 hover:border-primary/40 hover:bg-muted/50",
                  disabled && "cursor-default opacity-90",
                  !disabled && "cursor-pointer active:scale-[0.98]",
                )}
                aria-pressed={selected}
                aria-label={t("customerSurvey.public.ratingAria", { score: n })}
              >
                <Star
                  className={cn(
                    compact ? "h-6 w-6 sm:h-7 sm:w-7" : "h-7 w-7 sm:h-8 sm:w-8",
                    filled ? "fill-amber-400 text-amber-500" : "fill-transparent text-muted-foreground/50",
                  )}
                  aria-hidden
                />
              </button>
            );
          })}
        </div>
        <div className="flex justify-between gap-2 text-[11px] text-muted-foreground sm:text-xs">
          <span className="min-w-0 shrink text-left leading-tight">← {minLabel || "—"}</span>
          <span className="min-w-0 shrink text-right leading-tight">{maxLabel || "—"} →</span>
        </div>
    </div>
  );
}
