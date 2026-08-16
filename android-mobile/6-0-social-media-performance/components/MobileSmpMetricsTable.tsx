import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

export type MobileSmpMetricsColumn = {
  key: string;
  label: string;
  align?: "left" | "right";
  primary?: boolean;
  maxWidthClass?: string;
};

export type MobileSmpMetricsRow = {
  id: string;
  cells: Record<string, ReactNode>;
};

type MobileSmpMetricsTableProps = {
  columns: MobileSmpMetricsColumn[];
  rows: MobileSmpMetricsRow[];
  isLoading?: boolean;
  emptyText: string;
  itemLabel?: string;
  totalCount?: number;
};

export function MobileSmpMetricsTable({
  columns,
  rows,
  isLoading,
  emptyText,
  itemLabel,
  totalCount,
}: MobileSmpMetricsTableProps) {
  const { t } = useAppTranslation();
  const countLabel = itemLabel ?? t("common.rows", "rows");
  const shownCount = rows.length;
  const ofCount = totalCount ?? shownCount;
  const thClass =
    "sticky top-[-1px] z-20 whitespace-nowrap border-b border-border bg-muted px-3 py-2 pt-[9px] text-xs font-medium text-muted-foreground shadow-[0_-2px_0_0_hsl(var(--muted))]";
  const tdClass = "whitespace-nowrap border-b border-border/60 px-3 py-2.5 text-sm align-middle";

  const footer = (
    <div className="flex-shrink-0 border-t border-border bg-muted/50 px-3 py-2">
      <p className="truncate text-xs text-muted-foreground">
        {t("common.showing", "Showing")} {shownCount} {t("common.of", "of")} {ofCount} {countLabel}
      </p>
    </div>
  );
  const bodyHeightClass = "h-[22.5rem] min-h-[22.5rem] max-h-[22.5rem]";

  if (isLoading && rows.length === 0) {
    return (
      <div className="-mx-2 flex min-w-0 shrink-0 flex-col overflow-hidden border-y border-border bg-card" aria-busy>
        <div className={cn(bodyHeightClass, "overflow-hidden")}>
          <div className="space-y-0 p-3">
            <div className="mb-3 flex gap-3">
              <div className="h-3 w-20 animate-pulse rounded bg-muted/50" />
              <div className="h-3 w-14 animate-pulse rounded bg-muted/40" />
              <div className="h-3 w-16 animate-pulse rounded bg-muted/50" />
              <div className="h-3 w-12 animate-pulse rounded bg-muted/40" />
              <div className="h-3 w-12 animate-pulse rounded bg-muted/40" />
            </div>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-2">
                <div className="h-3 w-28 animate-pulse rounded bg-muted/40" />
                <div className="h-3 w-12 animate-pulse rounded bg-muted/50" />
                <div className="h-3 w-10 animate-pulse rounded bg-muted/40" />
                <div className="h-3 w-10 animate-pulse rounded bg-muted/50" />
                <div className="h-3 w-14 animate-pulse rounded bg-muted/40" />
              </div>
            ))}
          </div>
        </div>
        {footer}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="-mx-2 flex min-w-0 shrink-0 flex-col overflow-hidden border-y border-border bg-card">
        <div className={cn(bodyHeightClass, "flex items-center justify-center px-4 text-center text-sm text-muted-foreground")}>
          {emptyText}
        </div>
        {footer}
      </div>
    );
  }

  return (
    <div className="-mx-2 flex min-w-0 shrink-0 flex-col overflow-hidden border-y border-border bg-card">
      <div
        className={cn(
          "nested-scroll-touch-chain-xy scrollbar-hide min-w-0 w-full overflow-auto overscroll-contain",
          bodyHeightClass,
          "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        )}
      >
        <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    thClass,
                    col.align === "right" ? "text-right" : "text-left",
                    col.maxWidthClass,
                  )}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="bg-card">
                {columns.map((col) => {
                  const content = row.cells[col.key] ?? "—";
                  const text = typeof content === "string" ? content : undefined;
                  return (
                    <td
                      key={col.key}
                      className={cn(
                        tdClass,
                        col.align === "right" && "text-right tabular-nums",
                        text && col.primary && "max-w-[11rem] truncate font-medium",
                        text && col.maxWidthClass && "truncate",
                        col.maxWidthClass,
                      )}
                      title={text}
                    >
                      {content}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footer}
    </div>
  );
}
