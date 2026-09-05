import { useEffect, useRef, type RefObject } from "react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { PublicOrderCatalogItem, PublicOrderCategory } from "@/synckerja-order/shared/lib/orderTypes";
import { ORDER_STOREFRONT_PX } from "../lib/orderStorefrontGutter";
import {
  orderCategorySectionId,
  useOrderCategoryScrollSpy,
} from "../lib/useOrderCategoryScrollSpy";
import type { OrderProductRatingSummary } from "../ratings";
import { ratingSummaryFor } from "../ratings";
import { OrderCategorySection } from "./OrderCategorySection";
import { OrderListRow } from "./OrderProductTiles";

type Props = {
  categories: PublicOrderCategory[];
  items: PublicOrderCatalogItem[];
  filterCategoryId: string;
  highlightId: string;
  qtyByCatalogId: Map<string, number>;
  ratingByCatalogId?: Map<string, OrderProductRatingSummary>;
  tableFull: boolean;
  bottomPad?: boolean;
  /** Catalog page scroll container (hero + tabs + sections). */
  scrollRootRef: RefObject<HTMLElement | null>;
  onHighlight: (id: string) => void;
  onViewAll: (id: string) => void;
  onAdd: (item: PublicOrderCatalogItem) => void;
  onRemove: (item: PublicOrderCatalogItem) => void;
  onOpenSheet?: (item: PublicOrderCatalogItem) => void;
  onOpenDetail?: (item: PublicOrderCatalogItem) => void;
};

export function OrderStoreCatalog({
  categories,
  items,
  filterCategoryId,
  highlightId,
  qtyByCatalogId,
  ratingByCatalogId,
  tableFull,
  bottomPad,
  scrollRootRef,
  onHighlight,
  onViewAll,
  onAdd,
  onRemove,
  onOpenSheet,
  onOpenDetail,
}: Props) {
  const { t } = useAppTranslation();
  const tabsStripRef = useRef<HTMLDivElement>(null);
  const tabBtnRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const suppressSpyUntilRef = useRef(0);

  const activeTab = filterCategoryId || highlightId || categories[0]?.id || "";
  const byCategory = (id: string) => items.filter((item) => item.product_category_id === id);
  const uncategorized = items.filter((item) => !item.product_category_id);
  const listMode = Boolean(filterCategoryId);
  const listCategory = listMode ? categories.find((c) => c.id === filterCategoryId) : null;
  const tabsFullBleed = categories.length > 1;
  const spyCategoryIds = categories
    .filter((cat) => byCategory(cat.id).length > 0)
    .map((cat) => cat.id);

  useOrderCategoryScrollSpy({
    scrollRootRef,
    categoryIds: spyCategoryIds,
    enabled: !listMode && spyCategoryIds.length > 0,
    activeId: highlightId,
    onActiveId: onHighlight,
    suppressUntilRef: suppressSpyUntilRef,
  });

  useEffect(() => {
    if (!activeTab) return;
    const btn = tabBtnRefs.current.get(activeTab);
    btn?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeTab]);

  const handleTabClick = (id: string) => {
    suppressSpyUntilRef.current = Date.now() + 700;
    onHighlight(id);
    window.requestAnimationFrame(() => {
      document.getElementById(orderCategorySectionId(id))?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  return (
    <>
      <div className="sticky top-0 z-10 w-full border-b border-neutral-200 bg-white">
        <div
          ref={tabsStripRef}
          className={`flex min-w-0 overflow-x-auto scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
            tabsFullBleed ? "w-full" : `w-max max-w-full ${ORDER_STOREFRONT_PX}`
          }`}
        >
          {categories.map((cat) => {
            const active = activeTab === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                ref={(el) => {
                  if (el) tabBtnRefs.current.set(cat.id, el);
                  else tabBtnRefs.current.delete(cat.id);
                }}
                onClick={() => handleTabClick(cat.id)}
                className={`whitespace-nowrap py-3 text-[12px] font-semibold uppercase tracking-wide ${
                  tabsFullBleed ? "min-w-max flex-1 px-3 text-center" : "shrink-0 px-1"
                } ${
                  active ? "border-b-[3px] border-[#E86B2A] text-neutral-900" : "text-neutral-400"
                }`}
              >
                {cat.name}
              </button>
            );
          })}
        </div>
      </div>

      <div
        className={`flex-1 bg-neutral-100 ${
          bottomPad ? "pb-[calc(6.75rem+env(safe-area-inset-bottom,0px))]" : "pb-6"
        }`}
      >
        <div className="flex flex-col gap-1.5 pt-1.5">
          {listCategory ? (
            <OrderCategorySection
              category={listCategory}
              items={byCategory(listCategory.id)}
              qtyByCatalogId={qtyByCatalogId}
              ratingByCatalogId={ratingByCatalogId}
              disabled={tableFull}
              forceList
              onAdd={onAdd}
              onRemove={onRemove}
              onOpenSheet={onOpenSheet}
              onOpenDetail={onOpenDetail}
            />
          ) : (
            categories.map((cat) => (
              <OrderCategorySection
                key={cat.id}
                category={cat}
                items={byCategory(cat.id)}
                qtyByCatalogId={qtyByCatalogId}
                ratingByCatalogId={ratingByCatalogId}
                disabled={tableFull}
                onViewAll={onViewAll}
                onAdd={onAdd}
                onRemove={onRemove}
                onOpenSheet={onOpenSheet}
                onOpenDetail={onOpenDetail}
              />
            ))
          )}

          {!listMode && uncategorized.length > 0 ? (
            <section className="bg-white py-2.5">
              <h2 className={`mb-2.5 pt-1 ${ORDER_STOREFRONT_PX} text-[15px] font-bold uppercase tracking-wide text-neutral-900`}>
                {t("synckerjaOrder.store.other", "Other")}
              </h2>
              <div className={`divide-y divide-neutral-100 ${ORDER_STOREFRONT_PX}`}>
                {uncategorized.map((item) => (
                  <OrderListRow
                    key={item.id}
                    item={item}
                    qty={qtyByCatalogId.get(item.id) ?? 0}
                    ratingSummary={ratingSummaryFor(ratingByCatalogId, item.id)}
                    disabled={tableFull}
                    onAdd={() => onAdd(item)}
                    onRemove={() => onRemove(item)}
                    onOpenSheet={onOpenSheet ? () => onOpenSheet(item) : undefined}
                    onOpenDetail={onOpenDetail ? () => onOpenDetail(item) : undefined}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {items.length === 0 ? (
            <p className={`bg-white ${ORDER_STOREFRONT_PX} py-8 text-center text-sm text-neutral-400`}>
              {t("synckerjaOrder.store.noItems", "No menu items yet.")}
            </p>
          ) : null}
        </div>
      </div>
    </>
  );
}
