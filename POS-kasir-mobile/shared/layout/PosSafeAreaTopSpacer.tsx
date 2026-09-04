import { cn } from "@/shared/lib/utils";

type Props = {
  className?: string;
  /** Defaults to white so status icons stay readable on light status bar. */
  tone?: "white" | "primary";
};

/**
 * Dedicated status-bar band for POS phone chrome.
 * Must sit *above* toolbars (Menu/Bill/…) — do not put `safe-area-top` on those bars.
 */
export function PosSafeAreaTopSpacer({ className, tone = "white" }: Props) {
  return (
    <div
      aria-hidden
      className={cn(
        "safe-area-top flex-shrink-0",
        tone === "primary" ? "bg-primary" : "bg-white",
        className,
      )}
    />
  );
}
