import type { PublicOrderCatalogItem } from "@/synckerja-order/shared/lib/orderTypes";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import {
  ORDER_STOREFRONT_PX,
  ORDER_STOREFRONT_SCROLL_PAD,
  ORDER_STOREFRONT_SPACER,
} from "../../lib/orderStorefrontGutter";
import { OrderFeaturedCard } from "../../components/OrderProductTiles";
import { ORDER_CHECKOUT_I18N } from "../lib/orderCheckoutCopy";
import { ratingSummaryFor, type OrderProductRatingSummary } from "../../ratings";

export function OrderRelatedMenuRow({
  items,
  qtyByCatalogId,
  ratingByCatalogId,
  disabled,
  onAdd,
  onRemove,
  onOpenSheet,
  onOpenDetail,
}: {
  items: PublicOrderCatalogItem[];
  qtyByCatalogId: Map<string, number>;
  ratingByCatalogId?: Map<string, OrderProductRatingSummary>;
  disabled?: boolean;
  onAdd: (item: PublicOrderCatalogItem) => void;
  onRemove: (item: PublicOrderCatalogItem) => void;
  onOpenSheet: (item: PublicOrderCatalogItem) => void;
  onOpenDetail: (item: PublicOrderCatalogItem) => void;
}) {
  const { t } = useAppTranslation();
  if (items.length === 0) return null;

  return (
    <section className="py-3">
      <h2 className={`mb-2 text-[15px] font-bold uppercase tracking-wide text-neutral-900 ${ORDER_STOREFRONT_PX}`}>
        {t(ORDER_CHECKOUT_I18N.relatedMenu, "Related Menu")}
      </h2>
      <div
        className={`flex overflow-x-auto overflow-y-hidden pb-1 snap-x snap-mandatory ${ORDER_STOREFRONT_SCROLL_PAD} scrollbar-hide [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
      >
        <div className={ORDER_STOREFRONT_SPACER} aria-hidden />
        {items.map((item) => (
          <div key={item.id} className="mr-2 shrink-0">
            <OrderFeaturedCard
              item={item}
              qty={qtyByCatalogId.get(item.id) ?? 0}
              ratingSummary={ratingSummaryFor(ratingByCatalogId, item.id)}
              disabled={disabled}
              onAdd={() => onAdd(item)}
              onRemove={() => onRemove(item)}
              onOpenSheet={() => onOpenSheet(item)}
              onOpenDetail={() => onOpenDetail(item)}
            />
          </div>
        ))}
        <div className={ORDER_STOREFRONT_SPACER} aria-hidden />
      </div>
    </section>
  );
}
