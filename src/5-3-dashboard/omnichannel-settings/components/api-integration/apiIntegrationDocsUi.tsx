import { type ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

/** Satu ukuran font di seluruh panel docs (teks + inline code). */
export const docsTextClass = "text-sm leading-6";
export const docsInlineCodeClass =
  "inline rounded bg-muted/80 px-1.5 py-px align-baseline font-mono text-sm font-normal leading-6 text-foreground";

const numberedCardRowClass =
  "flex items-start gap-3 rounded-md border border-border/70 bg-muted/15 px-3 py-2.5";
const numberedBadgeClass =
  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium tabular-nums text-muted-foreground";

export function renderInlineMarkdownText(text: string): ReactNode[] {
  const segments = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return segments.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={index} className={docsInlineCodeClass}>
          {part.slice(1, -1)}
        </code>
      );
    }
    return part ? <span key={index}>{part}</span> : null;
  });
}

export function DocsNumberedCardList({
  items,
  renderItem,
}: {
  items: Array<ReactNode | string>;
  renderItem?: (item: ReactNode | string, index: number) => ReactNode;
}) {
  if (items.length === 0) return null;

  return (
    <ol className="my-3 list-none space-y-2 pl-0">
      {items.map((item, index) => (
        <li key={index} className={numberedCardRowClass}>
          <span className={numberedBadgeClass} aria-hidden>
            {index + 1}
          </span>
          <div className={cn("min-w-0 flex-1 text-foreground", docsTextClass)}>
            {renderItem
              ? renderItem(item, index)
              : typeof item === "string"
                ? renderInlineMarkdownText(item)
                : item}
          </div>
        </li>
      ))}
    </ol>
  );
}
