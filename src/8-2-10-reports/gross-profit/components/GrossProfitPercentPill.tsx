import { cn } from "@/shared/lib/utils";

type Props = {
  percent: number;
  variant: "net" | "cogs" | "profit";
  className?: string;
};

export function GrossProfitPercentPill({ percent, variant, className }: Props) {
  return (
    <span
      className={cn(
        "ml-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
        variant === "net" && "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
        variant === "cogs" && "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
        variant === "profit" && "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
        className,
      )}
    >
      {`${percent}%`}
    </span>
  );
}
