import { cn } from "@/shared/lib/utils";

export function formatSignedDeviationPercent(deviationPercent: number): string {
  if (deviationPercent === 0) return "0%";
  const sign = deviationPercent > 0 ? "+" : "−";
  return `${sign}${Math.abs(deviationPercent)}%`;
}

type Props = {
  deviationPercent: number;
  className?: string;
  size?: "sm" | "md";
};

export function DeviationProgressBar({ deviationPercent, className, size = "md" }: Props) {
  const clampedMagnitude = Math.min(Math.abs(deviationPercent), 100);
  const halfWidth = clampedMagnitude / 2;
  const isNegative = deviationPercent < 0;
  const isPositive = deviationPercent > 0;

  const labelClass =
    isNegative ? "text-red-600" : isPositive ? "text-emerald-700" : "text-muted-foreground";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn(
          "relative flex-1 rounded-full bg-gray-200",
          size === "sm" ? "h-1.5" : "h-2",
        )}
      >
        <div
          className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gray-400"
          aria-hidden
        />
        {isNegative ? (
          <div
            className={cn(
              "absolute inset-y-0 rounded-full bg-red-500 transition-all duration-300",
              size === "sm" ? "h-1.5" : "h-2",
            )}
            style={{
              right: "50%",
              width: `${halfWidth}%`,
            }}
          />
        ) : null}
        {isPositive ? (
          <div
            className={cn(
              "absolute inset-y-0 rounded-full bg-emerald-600 transition-all duration-300",
              size === "sm" ? "h-1.5" : "h-2",
            )}
            style={{
              left: "50%",
              width: `${halfWidth}%`,
            }}
          />
        ) : null}
      </div>
      <span
        className={cn(
          "min-w-[2.5rem] text-right text-xs font-medium tabular-nums",
          labelClass,
        )}
      >
        {formatSignedDeviationPercent(deviationPercent)}
      </span>
    </div>
  );
}
