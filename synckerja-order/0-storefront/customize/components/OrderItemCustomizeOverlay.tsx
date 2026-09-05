import { Check } from "lucide-react";
import { useEffect, useMemo, useState, type MutableRefObject } from "react";
import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { PublicOrderCatalogItem } from "@/synckerja-order/shared/lib/orderTypes";
import { usePublicOrderItemOptions } from "../hooks/usePublicOrderItemOptions";
import { useOrderItemCustomizeState } from "../hooks/useOrderItemCustomizeState";
import { mapOrderCustomizeToCartLine } from "../lib/mapOrderCustomizeToCartLine";
import { ORDER_CUSTOMIZE_I18N } from "../lib/orderCustomizeCopy";
import { ORDER_STOREFRONT_PX } from "../../lib/orderStorefrontGutter";
import {
  orderDetailMotionClass,
  useOrderSurfaceMotion,
} from "../../lib/useOrderSurfaceMotion";
import { OrderItemCustomizeHero } from "./OrderItemCustomizeHero";
import { OrderItemPhotoLightbox } from "./OrderItemPhotoLightbox";
import { OrderItemCustomizeInfo } from "./OrderItemCustomizeInfo";
import { OrderItemCustomizeGroup } from "./OrderItemCustomizeGroup";
import { OrderItemCustomizeOptionRow } from "./OrderItemCustomizeOptionRow";
import { OrderItemCustomizeFooter } from "./OrderItemCustomizeFooter";
import { OrderItemCustomizeNotes } from "./OrderItemCustomizeNotes";
import {
  OrderProductReviewsBlock,
  ratingSummaryFor,
  usePublicOrderProductRatingMap,
} from "../../ratings";

type Props = {
  code: string;
  item: PublicOrderCatalogItem;
  locked?: boolean;
  initialLine?: CustomerVisitCartLine | null;
  consumeBackRef?: MutableRefObject<() => boolean>;
  onClose: () => void;
  onConfirm: (line: CustomerVisitCartLine) => void;
};

export function OrderItemCustomizeOverlay({
  code,
  item,
  locked,
  initialLine,
  consumeBackRef,
  onClose,
  onConfirm,
}: Props) {
  const { t } = useAppTranslation();
  const [lightbox, setLightbox] = useState(false);
  const { exiting, requestClose } = useOrderSurfaceMotion(onClose);
  const optionsQuery = usePublicOrderItemOptions({ code, itemId: item.id });
  const options = optionsQuery.data;
  const state = useOrderItemCustomizeState(options?.ok ? options : undefined, initialLine);
  const ratingMapQuery = usePublicOrderProductRatingMap({
    code,
    catalogItemIds: [item.id],
  });
  const ratingSummary = ratingSummaryFor(ratingMapQuery.data, item.id);

  const description = useMemo(() => {
    if (options?.ok && options.included_items.length > 0) {
      return options.included_items
        .map((row) => (row.quantity > 1 ? `${row.quantity} ${row.name}` : row.name))
        .join(", ");
    }
    return options?.description ?? item.description;
  }, [item.description, options]);

  const photoUrl = options?.photo_url ?? item.photo_url;
  const optionsReady = Boolean(options?.ok && (!initialLine || state.hydrated));
  const canAdd = Boolean(optionsReady && state.valid && state.lineTotal > 0 && !locked);

  useEffect(() => {
    if (!consumeBackRef) return;
    consumeBackRef.current = () => {
      if (lightbox) {
        setLightbox(false);
        return true;
      }
      if (!exiting) {
        requestClose();
        return true;
      }
      return true;
    };
    return () => {
      consumeBackRef.current = () => false;
    };
  }, [consumeBackRef, lightbox, exiting, requestClose]);

  const onAdd = () => {
    if (!options?.ok || !canAdd) return;
    onConfirm(
      mapOrderCustomizeToCartLine({
        item,
        options,
        selection: state.selection,
        quantity: state.qty,
        kitchenNote: state.kitchenNote,
      }),
    );
    requestClose();
  };

  return (
    <div
      className={`absolute inset-0 z-40 flex flex-col bg-white ${orderDetailMotionClass(exiting)}`}
    >
      <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <OrderItemCustomizeHero
          photoUrl={photoUrl}
          name={item.name}
          onClose={requestClose}
          onExpand={() => {
            if (photoUrl) setLightbox(true);
          }}
        />
        {optionsQuery.isLoading || (Boolean(initialLine) && options?.ok && !state.hydrated) ? (
          <p className={`${ORDER_STOREFRONT_PX} py-6 text-sm text-neutral-400`}>
            {t(ORDER_CUSTOMIZE_I18N.loadingOptions, "Loading options…")}
          </p>
        ) : optionsQuery.isError || options?.ok === false ? (
          <p className={`${ORDER_STOREFRONT_PX} py-6 text-sm text-red-600`}>
            {t(ORDER_CUSTOMIZE_I18N.optionsError, "Could not load item options.")}
          </p>
        ) : optionsReady ? (
          <>
            <OrderItemCustomizeInfo
              name={options.name || item.name}
              price={state.unitPrice}
              description={description}
              ratingSummary={ratingSummary}
            />
            {options.variants.length > 1 ? (
              <section className={`border-b border-neutral-200 ${ORDER_STOREFRONT_PX} py-3`}>
                <div className="mb-1 flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[14px] font-bold uppercase text-neutral-900">
                      {t("synckerjaOrder.store.customize.variant", "Variant")}
                    </p>
                    <p className="text-[12px] text-neutral-400">
                      {t(ORDER_CUSTOMIZE_I18N.mustSelectMax, "Must be selected max. {{count}}", {
                        count: 1,
                      })}
                    </p>
                  </div>
                  {state.selection.variantId ? (
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                  ) : (
                    <span className="h-6 w-6 shrink-0 rounded-full border border-neutral-200" />
                  )}
                </div>
                <div className="divide-y divide-neutral-100">
                  {options.variants.map((variant) => (
                    <OrderItemCustomizeOptionRow
                      key={variant.id}
                      name={variant.name}
                      selected={state.selection.variantId === variant.id}
                      disabled={variant.out_of_stock}
                      outOfStock={variant.out_of_stock}
                      onToggle={() => {
                        if (!variant.out_of_stock) state.setVariantId(variant.id);
                      }}
                    />
                  ))}
                </div>
              </section>
            ) : null}
            {options.modifier_groups.map((group) => (
              <OrderItemCustomizeGroup
                key={group.id}
                group={group}
                selectedIds={state.selection.selectedByGroup[group.id] ?? []}
                qtyByOption={state.selection.qtyByGroup[group.id]}
                valid={state.groupValid(group.id)}
                onToggle={(optionId, outOfStock) => state.toggleOption(group.id, optionId, outOfStock)}
                onQty={(optionId, delta, outOfStock) =>
                  state.setOptionQty(group.id, optionId, delta, outOfStock)
                }
              />
            ))}
            <OrderItemCustomizeNotes value={state.kitchenNote} onChange={state.setKitchenNote} />
            <OrderProductReviewsBlock code={code} catalogItemId={item.id} />
          </>
        ) : null}
      </div>
      <OrderItemCustomizeFooter
        qty={state.qty}
        total={state.lineTotal}
        disabled={!canAdd}
        name={item.name}
        saveMode={Boolean(initialLine)}
        qtyLocked={Boolean(initialLine)}
        onDecrease={() => state.bumpQty(-1)}
        onIncrease={() => state.bumpQty(1)}
        onAdd={onAdd}
      />
      {lightbox && photoUrl ? (
        <OrderItemPhotoLightbox url={photoUrl} name={item.name} onClose={() => setLightbox(false)} />
      ) : null}
    </div>
  );
}
