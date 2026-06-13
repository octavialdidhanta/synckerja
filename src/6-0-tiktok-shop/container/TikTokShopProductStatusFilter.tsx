import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/utils";

export const TIKTOK_SHOP_PRODUCT_STATUS_OPTIONS = [
  { value: "", labelKey: "digitalMarketing.tiktokShop.products.statusAll", defaultLabel: "All" },
  {
    value: "ACTIVATE",
    labelKey: "digitalMarketing.tiktokShop.products.statusActive",
    defaultLabel: "Active",
  },
  {
    value: "DRAFT",
    labelKey: "digitalMarketing.tiktokShop.products.statusDraft",
    defaultLabel: "Draft",
  },
  {
    value: "PENDING",
    labelKey: "digitalMarketing.tiktokShop.products.statusPending",
    defaultLabel: "Pending",
  },
  {
    value: "FAILED",
    labelKey: "digitalMarketing.tiktokShop.products.statusFailed",
    defaultLabel: "Failed",
  },
  {
    value: "SELLER_DEACTIVATED",
    labelKey: "digitalMarketing.tiktokShop.products.statusDeactivated",
    defaultLabel: "Deactivated",
  },
] as const;

type Props = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

export function TikTokShopProductStatusFilter({ value, onChange, className }: Props) {
  const { t } = useTranslation();

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {TIKTOK_SHOP_PRODUCT_STATUS_OPTIONS.map((option) => {
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
