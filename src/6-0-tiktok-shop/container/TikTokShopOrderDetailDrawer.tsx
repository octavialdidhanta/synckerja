import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/shared/components/ui/sheet";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { useTikTokShopOrderDetailQuery } from "@/tiktok-shop/hooks/useTikTokShopPeriodSummaryQuery";
import { formatTikTokShopMoney } from "@/tiktok-shop/lib/formatTikTokShopMoney";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string | null | undefined;
  shopAccountId: string;
  orderId: string | null;
};

function formatTime(raw: number | null): string {
  if (raw == null || !Number.isFinite(raw)) return "—";
  const ms = raw >= 1_000_000_000_000 ? raw : raw * 1000;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(ms));
}

export function TikTokShopOrderDetailDrawer({
  open,
  onOpenChange,
  organizationId,
  shopAccountId,
  orderId,
}: Props) {
  const { t } = useTranslation();
  const { data, isPending, error } = useTikTokShopOrderDetailQuery({
    organizationId,
    shopAccountId,
    orderId,
    enabled: open && Boolean(orderId),
  });

  const order = data?.orders?.[0] ?? null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col overflow-hidden sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>
            {t("digitalMarketing.tiktokShop.dashboard.orderDetailTitle", "Order detail")}
          </SheetTitle>
          <SheetDescription className="font-mono text-xs">{orderId ?? ""}</SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto py-4">
          {isPending ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
              {t("digitalMarketing.tiktokShop.dashboard.orderDetailLoading", "Loading order…")}
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertDescription>
                {error instanceof Error
                  ? error.message
                  : t(
                      "digitalMarketing.tiktokShop.dashboard.orderDetailError",
                      "Could not load order detail",
                    )}
              </AlertDescription>
            </Alert>
          ) : !order ? (
            <p className="text-sm text-muted-foreground">
              {t("digitalMarketing.tiktokShop.dashboard.orderDetailNotFound", "Order not found.")}
            </p>
          ) : (
            <div className="space-y-5 text-sm">
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("digitalMarketing.tiktokShop.dashboard.detailOverview", "Overview")}
                </h3>
                <dl className="grid grid-cols-2 gap-2">
                  <div>
                    <dt className="text-muted-foreground">
                      {t("digitalMarketing.tiktokShop.dashboard.colStatus", "Status")}
                    </dt>
                    <dd className="capitalize">{order.status.replace(/_/g, " ")}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">
                      {t("digitalMarketing.tiktokShop.dashboard.colCreated", "Created")}
                    </dt>
                    <dd>{formatTime(order.create_time)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">
                      {t("digitalMarketing.tiktokShop.dashboard.detailUpdated", "Updated")}
                    </dt>
                    <dd>{formatTime(order.update_time)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">
                      {t("digitalMarketing.tiktokShop.dashboard.colGmv", "GMV")}
                    </dt>
                    <dd>{formatTikTokShopMoney(order.gmv, order.currency)}</dd>
                  </div>
                </dl>
              </section>

              {(order.recipient_name || order.recipient_address || order.tracking_number) && (
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("digitalMarketing.tiktokShop.dashboard.detailShipping", "Shipping")}
                  </h3>
                  <dl className="space-y-1">
                    {order.recipient_name ? (
                      <div>
                        <dt className="text-muted-foreground">
                          {t("digitalMarketing.tiktokShop.dashboard.detailRecipient", "Recipient")}
                        </dt>
                        <dd>{order.recipient_name}</dd>
                      </div>
                    ) : null}
                    {order.recipient_phone ? (
                      <div>
                        <dt className="text-muted-foreground">
                          {t("digitalMarketing.tiktokShop.dashboard.detailPhone", "Phone")}
                        </dt>
                        <dd>{order.recipient_phone}</dd>
                      </div>
                    ) : null}
                    {order.recipient_address ? (
                      <div>
                        <dt className="text-muted-foreground">
                          {t("digitalMarketing.tiktokShop.dashboard.detailAddress", "Address")}
                        </dt>
                        <dd>{order.recipient_address}</dd>
                      </div>
                    ) : null}
                    {order.tracking_number ? (
                      <div>
                        <dt className="text-muted-foreground">
                          {t("digitalMarketing.tiktokShop.dashboard.detailTracking", "Tracking")}
                        </dt>
                        <dd className="font-mono text-xs">{order.tracking_number}</dd>
                      </div>
                    ) : null}
                  </dl>
                </section>
              )}

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("digitalMarketing.tiktokShop.dashboard.detailPayment", "Payment")}
                </h3>
                <dl className="grid grid-cols-2 gap-2">
                  <div>
                    <dt className="text-muted-foreground">
                      {t("digitalMarketing.tiktokShop.dashboard.detailSubtotal", "Subtotal")}
                    </dt>
                    <dd>{formatTikTokShopMoney(order.payment_subtotal, order.currency)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">
                      {t("digitalMarketing.tiktokShop.dashboard.detailShippingFee", "Shipping")}
                    </dt>
                    <dd>{formatTikTokShopMoney(order.payment_shipping, order.currency)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">
                      {t("digitalMarketing.tiktokShop.dashboard.detailTax", "Tax")}
                    </dt>
                    <dd>{formatTikTokShopMoney(order.payment_tax, order.currency)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">
                      {t("digitalMarketing.tiktokShop.dashboard.detailDiscount", "Discount")}
                    </dt>
                    <dd>{formatTikTokShopMoney(order.payment_discount, order.currency)}</dd>
                  </div>
                </dl>
              </section>

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("digitalMarketing.tiktokShop.dashboard.detailLineItems", "Line items")}
                </h3>
                {order.line_items.length === 0 ? (
                  <p className="text-muted-foreground">
                    {t("digitalMarketing.tiktokShop.dashboard.detailNoItems", "No line items.")}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {order.line_items.map((item, index) => (
                      <li
                        key={`${item.sku_id}-${index}`}
                        className="rounded-md border border-gray-100 p-2"
                      >
                        <p className="font-medium">{item.product_name}</p>
                        <p className="text-xs text-muted-foreground">
                          SKU: {item.seller_sku || item.sku_id || "—"}
                        </p>
                        <p className="mt-1 text-xs">
                          {item.quantity} × {formatTikTokShopMoney(item.sale_price, item.currency)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
