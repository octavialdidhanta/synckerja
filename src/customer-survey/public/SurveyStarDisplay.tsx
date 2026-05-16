import { Star } from "lucide-react";
import { cn } from "@/shared/lib/utils";

type Props = {
  rating: number | null | undefined;
  max?: number;
  size?: "sm" | "md";
  className?: string;
};

/** Read-only 1–5 stars; null/undefined = all empty gray stars. */
export function SurveyStarDisplay({ rating, max = 5, size = "sm", className }: Props) {
  const filled =
    rating != null && Number.isFinite(rating) ? Math.min(max, Math.max(1, Math.round(rating))) : 0;
  const iconClass = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <div className={cn("inline-flex items-center gap-0.5", className)} aria-hidden>
      {Array.from({ length: max }, (_, i) => {
        const n = i + 1;
        const isFilled = filled > 0 && n <= filled;
        return (
          <Star
            key={n}
            className={cn(
              iconClass,
              isFilled ? "fill-amber-400 text-amber-500" : "fill-transparent text-muted-foreground/40",
            )}
          />
        );
      })}
    </div>
  );
}
