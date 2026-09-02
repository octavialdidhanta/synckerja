import { Plus, Utensils } from "lucide-react";
import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { PublicOrderCatalogItem } from "@/synckerja-order/shared/lib/orderTypes";
import { ORDER_STOREFRONT_PX } from "../../lib/orderStorefrontGutter";
import { ORDER_CHECKOUT_I18N } from "../lib/orderCheckoutCopy";
import type { OrderFulfillment } from "../lib/orderFulfillment";
import type { OrderCheckoutPreview } from "../lib/orderCheckoutPreview";
import {
  OrderCheckoutFooter,
  OrderCheckoutHeader,
  OrderCheckoutShell,
} from "./OrderCheckoutChrome";
import { OrderFulfillmentPicker } from "./OrderFulfillmentPicker";
import { OrderPaymentDetailsCard } from "./OrderPaymentDetailsCard";
import { OrderRelatedMenuRow } from "./OrderRelatedMenuRow";
import { OrderReviewLineBlock } from "./OrderReviewLineBlock";

const ACCENT = "#E91E8C";

export function OrderReviewScreen({
  code,
  lines,
  relatedItems,
  qtyByCatalogId,
  billNote,
  preview,
  fulfillment,
  allowTakeAway,
  disabled,
  onBack,
  onAddItem,
  onBillNoteChange,
  onFulfillmentChange,
  onContinue,
  onAddRelated,
  onRemoveRelated,
  onOpenRelatedSheet,
  onOpenRelatedDetail,
  onEditLine,
  onSetQty,
}: {
  code: string;
  lines: CustomerVisitCartLine[];
  relatedItems: PublicOrderCatalogItem[];
  qtyByCatalogId: Map<string, number>;
  billNote: string;
  preview: OrderCheckoutPreview;
  fulfillment: OrderFulfillment;
  allowTakeAway?: boolean;
  disabled?: boolean;
  onBack: () => void;
  onAddItem: () => void;
  onBillNoteChange: (value: string) => void;
  onFulfillmentChange: (value: OrderFulfillment) => void;
  onContinue: () => void;
  onAddRelated: (item: PublicOrderCatalogItem) => void;
  onRemoveRelated: (item: PublicOrderCatalogItem) => void;
  onOpenRelatedSheet: (item: PublicOrderCatalogItem) => void;
  onOpenRelatedDetail: (item: PublicOrderCatalogItem) => void;
  onEditLine: (line: CustomerVisitCartLine) => void;
  onSetQty: (lineKey: string, quantity: number) => void;
}) {
  const { t } = useAppTranslation();

  return (
    <OrderCheckoutShell>
      <OrderCheckoutHeader
        title={t(ORDER_CHECKOUT_I18N.orderTitle, "Order")}
        onBack={onBack}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {allowTakeAway ? (
          <OrderFulfillmentPicker
            value={fulfillment}
            onChange={onFulfillmentChange}
            disabled={disabled}
          />
        ) : (
          <div className={`flex items-center justify-between ${ORDER_STOREFRONT_PX} py-3`}>
            <span className="inline-flex items-center gap-2 text-[14px] font-medium text-neutral-800">
              <Utensils className="h-4 w-4" />
              {t(ORDER_CHECKOUT_I18N.orderType, "Order Type")}
            </span>
            <span className="text-[14px] font-semibold text-neutral-900">
              {t(ORDER_CHECKOUT_I18N.dineIn, "Dine In")}
            </span>
          </div>
        )}
        <OrderRelatedMenuRow
          items={relatedItems}
          qtyByCatalogId={qtyByCatalogId}
          disabled={disabled}
          onAdd={onAddRelated}
          onRemove={onRemoveRelated}
          onOpenSheet={onOpenRelatedSheet}
          onOpenDetail={onOpenRelatedDetail}
        />
        <section className={`${ORDER_STOREFRONT_PX} pt-2`}>
          <h2 className="mb-1 text-[15px] font-bold uppercase tracking-wide text-neutral-900">
            {t(ORDER_CHECKOUT_I18N.orderedItems, "Ordered Items")}
          </h2>
          {lines.map((line) => (
            <OrderReviewLineBlock
              key={line.lineKey}
              code={code}
              line={line}
              disabled={disabled}
              onEdit={() => onEditLine(line)}
              onSetQty={(quantity) => onSetQty(line.lineKey, quantity)}
            />
          ))}
          <button
            type="button"
            disabled={disabled}
            onClick={onAddItem}
            className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold disabled:opacity-40"
            style={{ color: ACCENT }}
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            {t(ORDER_CHECKOUT_I18N.addItem, "Add Item")}
          </button>
        </section>
        <section className={`${ORDER_STOREFRONT_PX} py-4`}>
          <label className="block text-[13px] font-medium text-neutral-800">
            {t(ORDER_CHECKOUT_I18N.billNotes, "Add another notes")}
            <textarea
              className="mt-2 min-h-[88px] w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-[13px] text-neutral-800 outline-none focus:border-neutral-400"
              value={billNote}
              maxLength={500}
              disabled={disabled}
              placeholder={t(
                ORDER_CHECKOUT_I18N.billNotesPlaceholder,
                "Notes for the whole bill (optional)",
              )}
              onChange={(e) => onBillNoteChange(e.target.value)}
            />
          </label>
        </section>
        <section className={`${ORDER_STOREFRONT_PX} pb-6`}>
          <OrderPaymentDetailsCard preview={preview} />
        </section>
      </div>
      <OrderCheckoutFooter
        total={preview.grandTotal}
        cta={t(ORDER_CHECKOUT_I18N.continueToPayment, "Continue to Payment")}
        disabled={disabled || lines.length === 0}
        onCta={onContinue}
      />
    </OrderCheckoutShell>
  );
}
