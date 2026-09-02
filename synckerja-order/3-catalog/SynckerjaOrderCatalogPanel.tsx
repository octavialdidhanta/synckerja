import { useMemo } from "react";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { formatStoreCheckoutRp } from "@/5-2-customer-visits/checkout/lib/catalogLabel";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { CategoryLayout } from "@/synckerja-order/shared/lib/orderCategoryLayout";
import type { SynckerjaOrderCatalogRow } from "../5-backoffice-shell/hooks/useSynckerjaOrderCatalog";
import { CategoryLayoutPicker } from "./CategoryLayoutPicker";
import { RelatedMenuPairingSection } from "./RelatedMenuPairingSection";

type Props = {
  rows: SynckerjaOrderCatalogRow[];
  layouts: Record<string, CategoryLayout>;
  onLayoutChange: (categoryId: string, layout: CategoryLayout) => void;
  onToggle: (id: string, optedIn: boolean, kind: "product" | "bundle") => void;
  relatedPairings?: Record<string, string>;
  onRelatedChange?: (fromCategoryId: string, toCategoryId: string | null) => void;
  busy?: boolean;
};

type CategoryGroup = {
  id: string | null;
  name: string;
  sortOrder: number;
  rows: SynckerjaOrderCatalogRow[];
};

export function SynckerjaOrderCatalogPanel({
  rows,
  layouts,
  onLayoutChange,
  onToggle,
  relatedPairings,
  onRelatedChange,
  busy,
}: Props) {
  const { t } = useAppTranslation();
  const groups = useMemo((): CategoryGroup[] => {
    const byId = new Map<string, CategoryGroup>();
    const uncategorized: SynckerjaOrderCatalogRow[] = [];
    const bundles: SynckerjaOrderCatalogRow[] = [];
    for (const row of rows) {
      if (row.kind === "bundle") {
        bundles.push(row);
        continue;
      }
      if (!row.product_category_id) {
        uncategorized.push(row);
        continue;
      }
      const existing = byId.get(row.product_category_id);
      if (existing) {
        existing.rows.push(row);
        continue;
      }
      byId.set(row.product_category_id, {
        id: row.product_category_id,
        name: row.product_category_name ?? "—",
        sortOrder: row.product_category_sort ?? 0,
        rows: [row],
      });
    }
    const sorted = [...byId.values()].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
    );
    if (uncategorized.length > 0) {
      sorted.push({
        id: null,
        name: t("synckerjaOrder.catalog.uncategorized", "Uncategorized"),
        sortOrder: 9999,
        rows: uncategorized,
      });
    }
    if (bundles.length > 0) {
      sorted.push({
        id: "bundles",
        name: t("synckerjaOrder.catalog.bundles", "Bundles"),
        sortOrder: 10000,
        rows: bundles,
      });
    }
    return sorted;
  }, [rows, t]);

  return (
    <div className="space-y-2 overflow-y-auto p-2 sm:p-3">
      <div className="rounded-md border border-border/60 bg-muted/20 px-2.5 py-2 text-xs leading-relaxed text-muted-foreground">
        <p>
          {t(
            "synckerjaOrder.catalog.hint",
            "Publish products assigned to this outlet in Item Library. Guests only see items you turn on here.",
          )}
        </p>
        <p className="mt-1">
          {t(
            "synckerjaOrder.catalog.layoutHint",
            "List is a vertical menu. Slider shows photo cards that peek off the edge. Grid shows two photo cards per row with vertical scroll.",
          )}
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
          {t(
            "synckerjaOrder.catalog.emptyOutlet",
            "No products are assigned to this outlet. Add them in Item Library, then publish them here.",
          )}
        </p>
      ) : null}
      {onRelatedChange ? (
        <RelatedMenuPairingSection
          categories={groups
            .filter((group) => group.id && group.id !== "bundles")
            .map((group) => ({ id: group.id as string, name: group.name }))}
          pairings={relatedPairings ?? {}}
          disabled={busy}
          onChange={onRelatedChange}
        />
      ) : null}
      {groups.map((group) => (
        <section key={group.id ?? "uncategorized"} className="rounded-md border border-border">
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-b bg-muted/15 px-2.5 py-1.5">
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate text-sm font-medium">{group.name}</p>
              <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {group.rows.length}
              </span>
            </div>
            {group.id && group.id !== "bundles" ? (
              <CategoryLayoutPicker
                value={layouts[group.id] ?? "list"}
                disabled={busy}
                onChange={(layout) => onLayoutChange(group.id as string, layout)}
              />
            ) : (
              <span className="text-[11px] text-muted-foreground">
                {t("synckerjaOrder.catalog.layoutListOnly", "List only")}
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 gap-1 p-1.5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {group.rows.map((row) => (
              <label
                key={row.id}
                className="flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1.5 hover:bg-muted/50"
              >
                <Checkbox
                  checked={row.opted_in}
                  disabled={busy}
                  onCheckedChange={(v) => onToggle(row.id, v === true, row.kind ?? "product")}
                />
                {row.photo_url ? (
                  <img src={row.photo_url} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />
                ) : (
                  <div className="h-8 w-8 shrink-0 rounded bg-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium leading-tight">{row.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {formatStoreCheckoutRp(row.unit_price)}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
