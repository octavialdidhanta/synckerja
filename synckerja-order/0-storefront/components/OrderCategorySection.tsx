import { ChevronRight } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { parseCategoryLayout, resolveCategorySection } from "@/synckerja-order/shared/lib/orderCategoryLayout";
import type { PublicOrderCatalogItem, PublicOrderCategory } from "@/synckerja-order/shared/lib/orderTypes";
import {
  ORDER_STOREFRONT_PX,
  ORDER_STOREFRONT_SCROLL_PAD,
  ORDER_STOREFRONT_SPACER,
} from "../lib/orderStorefrontGutter";
import { OrderFeaturedCard, OrderListRow } from "./OrderProductTiles";

function isPromoName(name: string): boolean {
  return /promo/i.test(name);
}

type Props = {
  category: PublicOrderCategory;
  items: PublicOrderCatalogItem[];
  qtyByCatalogId: Map<string, number>;
  disabled: boolean;
  forceList?: boolean;
  onViewAll?: (id: string) => void;
  onAdd: (item: PublicOrderCatalogItem) => void;
  onRemove: (item: PublicOrderCatalogItem) => void;
  onOpenSheet?: (item: PublicOrderCatalogItem) => void;
  onOpenDetail?: (item: PublicOrderCatalogItem) => void;
};

export function OrderCategorySection({
  category,
  items,
  qtyByCatalogId,
  disabled,
  forceList,
  onViewAll,
  onAdd,
  onRemove,
  onOpenSheet,
  onOpenDetail,
}: Props) {
  const { t } = useAppTranslation();
  const resolved = resolveCategorySection({
    layout: forceList ? "list" : parseCategoryLayout(category.layout),
    itemCount: items.length,
  });
  if (items.length === 0) return null;
  if (resolved.layout === "slider_bleed" && resolved.slider === "hidden") return null;

  const showSlider =
    !forceList && resolved.presentation === "slider" && resolved.slider !== "hidden";
  const showGrid = !forceList && resolved.presentation === "grid";
  const showViewAll =
    onViewAll &&
    ((showSlider && resolved.slider !== "hidden") || (showGrid && items.length >= 4));

  return (
    <section id={`order-cat-${category.id}`} className="scroll-mt-12 bg-white py-2.5">
      {isPromoName(category.name) ? (
        <p className={`mb-1.5 ${ORDER_STOREFRONT_PX} pt-1 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-400`}>
          {t("synckerjaOrder.store.promo", "Promo")}
        </p>
      ) : null}
      <div className={`mb-2.5 flex items-center justify-between pt-1 ${ORDER_STOREFRONT_PX}`}>
        <h2 className="text-[15px] font-bold uppercase tracking-wide text-neutral-900">
          {category.name}
        </h2>
        {showViewAll ? (
          <button
            type="button"
            className="inline-flex items-center text-[12px] text-neutral-500"
            onClick={() => onViewAll(category.id)}
          >
            {t("synckerjaOrder.store.viewAll", "View All")}
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      {showSlider ? (
        <div className={`flex overflow-x-auto overflow-y-hidden pb-2.5 snap-x snap-mandatory ${ORDER_STOREFRONT_SCROLL_PAD} scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}>
          <div className={ORDER_STOREFRONT_SPACER} aria-hidden />
          {items.map((item, index) => (
            <OrderFeaturedCard
              key={item.id}
              item={item}
              qty={qtyByCatalogId.get(item.id) ?? 0}
              disabled={disabled}
              bleed={resolved.slider === "bleed"}
              className={index > 0 ? "ml-2" : undefined}
              onAdd={() => onAdd(item)}
              onRemove={() => onRemove(item)}
              onOpenSheet={onOpenSheet ? () => onOpenSheet(item) : undefined}
              onOpenDetail={onOpenDetail ? () => onOpenDetail(item) : undefined}
            />
          ))}
          <div className={ORDER_STOREFRONT_SPACER} aria-hidden />
        </div>
      ) : showGrid ? (
        <div className={`grid grid-cols-2 gap-2 ${ORDER_STOREFRONT_PX}`}>
          {items.map((item) => (
            <OrderFeaturedCard
              key={item.id}
              item={item}
              qty={qtyByCatalogId.get(item.id) ?? 0}
              disabled={disabled}
              presentation="grid"
              onAdd={() => onAdd(item)}
              onRemove={() => onRemove(item)}
              onOpenSheet={onOpenSheet ? () => onOpenSheet(item) : undefined}
              onOpenDetail={onOpenDetail ? () => onOpenDetail(item) : undefined}
            />
          ))}
        </div>
      ) : (
        <div className={`divide-y divide-neutral-100 ${ORDER_STOREFRONT_PX}`}>
          {items.map((item) => (
            <OrderListRow
              key={item.id}
              item={item}
              qty={qtyByCatalogId.get(item.id) ?? 0}
              disabled={disabled}
              onAdd={() => onAdd(item)}
              onRemove={() => onRemove(item)}
              onOpenSheet={onOpenSheet ? () => onOpenSheet(item) : undefined}
              onOpenDetail={onOpenDetail ? () => onOpenDetail(item) : undefined}
            />
          ))}
        </div>
      )}
    </section>
  );
}
