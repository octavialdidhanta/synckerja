import { useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import {
  catalogItemLabel,
  formatStoreCheckoutRp,
  isCatalogItemOutOfStock,
} from "@/5-2-customer-visits/checkout/lib/catalogLabel";
import type { CustomerVisitCatalogItem } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { usePosCashierIsPhoneLayout } from "../hooks/usePosCashierIsPhoneLayout";
import { catalogItemInitials } from "../lib/catalogItemInitials";
import { POS_CASHIER_I18N } from "../lib/posCashierCopy";
import { recipeOutOfStockLabel } from "../lib/recipeOutOfStockLabel";
import {
  pageCount,
  paginateItems,
  posCashierPageSize,
} from "../lib/posCashierPagination";

const LONG_PRESS_MS = 500;

type Props = {
  items: CustomerVisitCatalogItem[];
  pageIndex: number;
  onPageChange: (page: number) => void;
  editing: boolean;
  onEnterEdit: () => void;
  onAddItem: (item: CustomerVisitCatalogItem) => void;
  onRemoveFavorite: (catalogId: string) => void;
  onReorder: (orderedIds: string[]) => void;
  onOpenAddDialog: () => void;
  disabled?: boolean;
  maxReached?: boolean;
  /** Catalog product id → total qty already on the bill. */
  qtyByCatalogId?: Map<string, number>;
  /** Catalog product IDs with base recipe that cannot serve 1 unit. */
  recipeOutOfStockIds?: Set<string>;
  recipeOutOfStockReasons?: Map<string, import("@/stock-management/recipe-availability").RecipeStockBlocker[]>;
};

/**
 * Favorit grid: browse (tap → cart) or edit (X, +, long-press/drag reorder).
 */
export function PosFavoritesGrid({
  items,
  pageIndex,
  onPageChange,
  editing,
  onEnterEdit,
  onAddItem,
  onRemoveFavorite,
  onReorder,
  onOpenAddDialog,
  disabled,
  maxReached,
  qtyByCatalogId,
  recipeOutOfStockIds,
  recipeOutOfStockReasons,
}: Props) {
  const { t } = useAppTranslation();
  const isPhoneLayout = usePosCashierIsPhoneLayout();
  const pageSize = posCashierPageSize(isPhoneLayout);
  const pages = pageCount(Math.max(items.length, editing ? 1 : 0), pageSize);
  const safePage = Math.min(pageIndex, pages - 1);
  const pageItems = paginateItems(items, safePage, pageSize);
  const emptySlots = editing
    ? Math.max(0, pageSize - pageItems.length)
    : 0;

  const longPressTimer = useRef<number | null>(null);
  const longPressFired = useRef(false);
  const dragFromId = useRef<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const clearLongPress = () => {
    if (longPressTimer.current != null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const startLongPress = () => {
    longPressFired.current = false;
    clearLongPress();
    longPressTimer.current = window.setTimeout(() => {
      longPressFired.current = true;
      onEnterEdit();
    }, LONG_PRESS_MS);
  };

  const moveItem = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const ids = items.map((i) => i.id);
    const from = ids.indexOf(fromId);
    const to = ids.indexOf(toId);
    if (from < 0 || to < 0) return;
    const next = [...ids];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onReorder(next);
  };

  if (!editing && items.length === 0) {
    return (
      <div
        className="flex h-full min-h-0 flex-col items-center justify-center gap-2 px-6 text-center"
        onPointerDown={startLongPress}
        onPointerUp={clearLongPress}
        onPointerLeave={clearLongPress}
        onPointerCancel={clearLongPress}
      >
        <p className="text-sm font-medium text-slate-600">
          {t(POS_CASHIER_I18N.favoritEmpty, "No favorites yet.")}
        </p>
        <p className="max-w-sm text-xs text-slate-400">
          {t(
            POS_CASHIER_I18N.favoritEmptyHint,
            "Long-press here to arrange favorite products.",
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className={cn(
          "scrollbar-hide seamless-scroll nested-scroll-touch-chain grid flex-1 auto-rows-max content-start overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          isPhoneLayout
            ? "grid-cols-3 gap-1.5 p-2"
            : "grid-cols-4 gap-2 p-3 sm:gap-3",
        )}
      >
        {pageItems.map((item) => {
          const fgOut = isCatalogItemOutOfStock(item);
          const recipeOut = Boolean(recipeOutOfStockIds?.has(item.id));
          const out = fgOut || recipeOut;
          const label = catalogItemLabel(item);
          const recipeLabel =
            recipeOut && !fgOut
              ? recipeOutOfStockLabel(t, recipeOutOfStockReasons?.get(item.id))
              : null;
          const bannerText = fgOut
            ? t(POS_CASHIER_I18N.recipeOutOfStock, "Out of stock")
            : recipeLabel?.text ?? t(POS_CASHIER_I18N.recipeOutOfStock, "Out of stock");
          const bannerTitle = fgOut ? bannerText : recipeLabel?.title ?? bannerText;
          const billQty = qtyByCatalogId?.get(item.id) ?? 0;
          return (
            <div
              key={item.id}
              className={cn(
                "relative h-full min-h-0",
                draggingId === item.id && "opacity-60",
                dragOverId === item.id && editing && "ring-2 ring-primary/50 rounded-lg",
              )}
              onPointerDown={(e) => {
                if (editing) {
                  dragFromId.current = item.id;
                  setDraggingId(item.id);
                  (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
                  return;
                }
                startLongPress();
              }}
              onPointerMove={(e) => {
                if (!editing || !dragFromId.current) return;
                const el = document.elementFromPoint(e.clientX, e.clientY);
                const tile = el?.closest("[data-fav-id]") as HTMLElement | null;
                const overId = tile?.dataset.favId ?? null;
                setDragOverId(overId);
              }}
              onPointerUp={(e) => {
                clearLongPress();
                if (editing && dragFromId.current) {
                  const el = document.elementFromPoint(e.clientX, e.clientY);
                  const tile = el?.closest("[data-fav-id]") as HTMLElement | null;
                  const toId = tile?.dataset.favId;
                  if (toId) moveItem(dragFromId.current, toId);
                  dragFromId.current = null;
                  setDraggingId(null);
                  setDragOverId(null);
                  return;
                }
                if (longPressFired.current) {
                  longPressFired.current = false;
                  return;
                }
                if (!disabled && !out && item.unitPrice > 0) onAddItem(item);
              }}
              onPointerCancel={() => {
                clearLongPress();
                dragFromId.current = null;
                setDraggingId(null);
                setDragOverId(null);
              }}
              onPointerLeave={() => {
                if (!editing) clearLongPress();
              }}
              data-fav-id={item.id}
            >
              <button
                type="button"
                disabled={editing ? false : disabled || out || !(item.unitPrice > 0)}
                className={cn(
                  "flex h-full w-full min-h-0 flex-col overflow-hidden rounded-lg bg-white text-left shadow-sm ring-1 ring-black/5",
                  "transition hover:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50",
                  editing && "pointer-events-none",
                )}
                tabIndex={editing ? -1 : 0}
              >
                <div className="relative aspect-square w-full shrink-0 bg-slate-100">
                  {item.photoUrl ? (
                    <img
                      src={item.photoUrl}
                      alt=""
                      className={cn("h-full w-full object-cover", out && "opacity-60")}
                      loading="lazy"
                      draggable={false}
                    />
                  ) : (
                    <div
                      className={cn(
                        "flex h-full w-full items-center justify-center bg-slate-300 text-2xl font-bold text-white",
                        out && "opacity-60",
                      )}
                    >
                      {catalogItemInitials(item)}
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
                  {!editing && billQty > 0 ? (
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
                <div className="flex flex-1 flex-col justify-start px-1.5 py-1.5">
                  <p className="line-clamp-2 h-[2.25rem] text-xs font-medium leading-[1.125rem] text-slate-900">
                    {label}
                  </p>
                  {!editing ? (
                    <p className="mt-0.5 truncate text-[10px] leading-4 text-slate-500">
                      {formatStoreCheckoutRp(item.unitPrice)}
                    </p>
                  ) : (
                    <p className="mt-0.5 h-4" aria-hidden />
                  )}
                </div>
              </button>
              {editing ? (
                <button
                  type="button"
                  aria-label={t(POS_CASHIER_I18N.favoritRemove, "Remove")}
                  className="absolute -left-1 -top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-slate-50"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveFavorite(item.id);
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          );
        })}

        {Array.from({ length: emptySlots }).map((_, i) => (
          <button
            key={`plus-${i}`}
            type="button"
            disabled={maxReached}
            onClick={() => {
              if (maxReached) return;
              onOpenAddDialog();
            }}
            onPointerDown={startLongPress}
            onPointerUp={clearLongPress}
            onPointerLeave={clearLongPress}
            onPointerCancel={clearLongPress}
            className={cn(
              "flex aspect-square flex-col items-center justify-center rounded-lg bg-slate-200 text-slate-500",
              "transition hover:bg-slate-300 disabled:opacity-40",
            )}
            aria-label={t(POS_CASHIER_I18N.favoritAdd, "Add favorite")}
          >
            <Plus className="h-10 w-10 stroke-[1.5]" />
          </button>
        ))}
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
