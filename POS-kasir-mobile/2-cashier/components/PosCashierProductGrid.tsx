import { isCatalogProductHidden } from "@/8-2-1-default-prices/lib/catalogKind";
import {
  catalogItemLabel,
  formatStoreCheckoutRp,
  isCatalogItemOutOfStock,
} from "@/5-2-customer-visits/checkout/lib/catalogLabel";
import type { CustomerVisitCatalogItem } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import type { RecipeStockBlocker } from "@/stock-management/recipe-availability";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { usePosCashierIsPhoneLayout } from "../hooks/usePosCashierIsPhoneLayout";
import { pageCount, paginateItems, posCashierPageSize } from "../lib/posCashierPagination";
import { POS_CASHIER_I18N } from "../lib/posCashierCopy";
import { recipeOutOfStockLabel } from "../lib/recipeOutOfStockLabel";

type Props = {
  items: CustomerVisitCatalogItem[];
  pageIndex: number;
  onPageChange: (page: number) => void;
  onAddItem: (item: CustomerVisitCatalogItem) => void;
  disabled?: boolean;
  /** Catalog product id → total qty already on the bill. */
  qtyByCatalogId?: Map<string, number>;
  /** Catalog product IDs with base recipe that cannot serve 1 unit. */
  recipeOutOfStockIds?: Set<string>;
  recipeOutOfStockReasons?: Map<string, RecipeStockBlocker[]>;
};

export function PosCashierProductGrid({
  items,
  pageIndex,
  onPageChange,
  onAddItem,
  disabled,
  qtyByCatalogId,
  recipeOutOfStockIds,
  recipeOutOfStockReasons,
}: Props) {
  const { t } = useAppTranslation();
  const isPhoneLayout = usePosCashierIsPhoneLayout();
  const pageSize = posCashierPageSize(isPhoneLayout);
  const visible = items.filter(
    (item) => item.kind !== "product" || !isCatalogProductHidden(item.posStatus),
  );
  const pages = pageCount(visible.length, pageSize);
  const safePage = Math.min(pageIndex, pages - 1);
  const pageItems = paginateItems(visible, safePage, pageSize);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className={cn(
          "scrollbar-hide seamless-scroll nested-scroll-touch-chain grid flex-1 auto-rows-max content-start gap-2 overflow-y-auto overflow-x-hidden p-3 sm:gap-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          isPhoneLayout ? "grid-cols-3" : "grid-cols-4",
        )}
      >
        {pageItems.map((item) => {
          const fgOut = isCatalogItemOutOfStock(item);
          const recipeOut = Boolean(recipeOutOfStockIds?.has(item.id));
          const out = fgOut || recipeOut;
          const recipeLabel =
            recipeOut && !fgOut
              ? recipeOutOfStockLabel(t, recipeOutOfStockReasons?.get(item.id))
              : null;
          const bannerText = fgOut
            ? t(POS_CASHIER_I18N.recipeOutOfStock, "Out of stock")
            : recipeLabel?.text ?? t(POS_CASHIER_I18N.recipeOutOfStock, "Out of stock");
          const bannerTitle = fgOut
            ? bannerText
            : recipeLabel?.title ?? bannerText;
          const billQty = qtyByCatalogId?.get(item.id) ?? 0;
          return (
            <button
              key={item.id}
              type="button"
              disabled={disabled || out || !(item.unitPrice > 0)}
              onClick={() => onAddItem(item)}
              className={cn(
                "relative flex flex-col overflow-hidden rounded-lg bg-white text-left shadow-sm ring-1 ring-black/5",
                "transition hover:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              <div className="relative aspect-square w-full bg-slate-100">
                {item.photoUrl ? (
                  <img
                    src={item.photoUrl}
                    alt=""
                    className={cn("h-full w-full object-cover", out && "opacity-60")}
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-slate-200 text-xs text-slate-500">
                    —
                  </div>
                )}
                {out ? (
                  <span
                    title={bannerTitle}
                    className="absolute inset-x-0 bottom-0 bg-rose-600/90 px-1 py-0.5 text-center text-[9px] font-semibold uppercase leading-tight tracking-wide text-white"
                  >
                    {bannerText}
                  </span>
                ) : null}
                {billQty > 0 ? (
                  <div
                    aria-label={`${billQty} on bill`}
                    className="absolute inset-0 z-[1] flex items-center justify-center bg-slate-950/45"
                  >
                    <span className="text-[1.75rem] font-bold leading-none tabular-nums tracking-tight text-white drop-shadow-sm sm:text-[2rem]">
                      ×{billQty > 99 ? "99+" : billQty}
                    </span>
                  </div>
                ) : null}
              </div>
              <div className="px-1.5 py-1.5">
                <p className="line-clamp-2 text-xs font-medium leading-tight text-slate-900">
                  {catalogItemLabel(item)}
                </p>
                <p className="truncate text-[10px] text-slate-500">
                  {formatStoreCheckoutRp(item.unitPrice)}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-shrink-0 items-center justify-center gap-1.5 py-2">
        {Array.from({ length: pages }, (_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Page ${i + 1}`}
            aria-current={i === safePage ? "page" : undefined}
            onClick={() => onPageChange(i)}
            className={cn(
              "h-2 w-2 rounded-full",
              i === safePage ? "bg-primary" : "bg-slate-300",
            )}
          />
        ))}
      </div>
    </div>
  );
}
