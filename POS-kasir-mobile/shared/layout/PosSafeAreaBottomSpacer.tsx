import { cn } from "@/shared/lib/utils";

type Props = {
  className?: string;
};

/**
 * Home-indicator / nav-scrim band for POS full-screen chrome.
 * Sit *below* scroll content (sibling of the page column), matching
 * {@link PosSafeAreaTopSpacer}. Uses `.safe-area-bottom` so
 * `html[data-keyboard-open]` can collapse plugin vars without fighting `env()`.
 */
export function PosSafeAreaBottomSpacer({ className }: Props) {
  return (
    <div
      aria-hidden
      className={cn("safe-area-bottom flex-shrink-0 bg-inherit", className)}
    />
  );
}
