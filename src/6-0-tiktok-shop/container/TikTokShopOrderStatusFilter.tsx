import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/utils";

export const TIKTOK_SHOP_ORDER_STATUS_OPTIONS = [
  { value: "", labelKey: "digitalMarketing.tiktokShop.dashboard.statusAll", defaultLabel: "All" },
  {
    value: "UNPAID",
    labelKey: "digitalMarketing.tiktokShop.dashboard.statusUnpaid",
    defaultLabel: "Unpaid",
  },
  {
    value: "ON_HOLD",
    labelKey: "digitalMarketing.tiktokShop.dashboard.statusOnHold",
    defaultLabel: "On hold",
  },
  {
    value: "AWAITING_SHIPMENT",
    labelKey: "digitalMarketing.tiktokShop.dashboard.statusAwaitingShipment",
    defaultLabel: "Awaiting shipment",
  },
  {
    value: "AWAITING_COLLECTION",
    labelKey: "digitalMarketing.tiktokShop.dashboard.statusAwaitingCollection",
    defaultLabel: "Awaiting collection",
  },
  {
    value: "IN_TRANSIT",
    labelKey: "digitalMarketing.tiktokShop.dashboard.statusInTransit",
    defaultLabel: "In transit",
  },
  {
    value: "DELIVERED",
    labelKey: "digitalMarketing.tiktokShop.dashboard.statusDelivered",
    defaultLabel: "Delivered",
  },
  {
    value: "COMPLETED",
    labelKey: "digitalMarketing.tiktokShop.dashboard.statusCompleted",
    defaultLabel: "Completed",
  },
  {
    value: "CANCELLED",
    labelKey: "digitalMarketing.tiktokShop.dashboard.statusCancelled",
    defaultLabel: "Cancelled",
  },
] as const;

type Props = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

export function TikTokShopOrderStatusFilter({ value, onChange, className }: Props) {
  const { t } = useTranslation();

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {TIKTOK_SHOP_ORDER_STATUS_OPTIONS.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value || "all"}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs transition-colors",
              active
                ? "border-primary bg-primary/10 font-medium text-primary"
                : "border-gray-200 bg-white text-muted-foreground hover:border-gray-300 hover:text-foreground",
            )}
          >
            {t(option.labelKey, option.defaultLabel)}
          </button>
        );
      })}
    </div>
  );
}
