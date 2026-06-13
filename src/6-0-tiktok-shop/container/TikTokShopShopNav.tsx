import { Store } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/utils";
import type { TikTokShopAccountRow } from "@/tiktok-shop/hooks/useTikTokShopSettings";

type TikTokShopShopNavProps = {
  shops: TikTokShopAccountRow[];
  shopAccountId: string;
  onShopAccountIdChange: (accountId: string) => void;
  shopsPending?: boolean;
  className?: string;
};

const SHOP_NAV_MAX_VISIBLE = 8;

function navItemClassName(isActive: boolean) {
  return cn(
    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
    "disabled:cursor-not-allowed disabled:opacity-50",
    isActive
      ? "bg-gray-200/80 font-medium text-gray-900"
      : "text-gray-700 hover:bg-gray-100",
  );
}

export function TikTokShopShopNav({
  shops,
  shopAccountId,
  onShopAccountIdChange,
  shopsPending = false,
  className,
}: TikTokShopShopNavProps) {
  const { t } = useTranslation();
  const activeShops = shops.filter((s) => s.is_active);
  const visible = activeShops.slice(0, SHOP_NAV_MAX_VISIBLE);
  const overflow = activeShops.length - visible.length;

  return (
    <nav className={cn("flex min-h-0 flex-col", className)} aria-label={t("digitalMarketing.tiktokShop.dashboard.shopNav", "Shops")}>
      <p className="mb-1 px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {t("digitalMarketing.tiktokShop.dashboard.shops", "Shops")}
      </p>
      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto">
        {shopsPending && visible.length === 0 ? (
          <p className="px-2 text-xs text-muted-foreground">
            {t("digitalMarketing.tiktokShop.dashboard.loadingShops", "Loading shops…")}
          </p>
        ) : null}
        {visible.map((shop) => {
          const isActive = shop.id === shopAccountId;
          const label = shop.label || shop.shop_name || shop.shop_id;
          return (
            <button
              key={shop.id}
              type="button"
              className={navItemClassName(isActive)}
              onClick={() => onShopAccountIdChange(shop.id)}
              disabled={shopsPending}
            >
              <Store className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{label}</span>
              {shop.is_default ? (
                <span className="shrink-0 text-[10px] uppercase text-muted-foreground">
                  {t("digitalMarketing.tiktokShop.default", "Default")}
                </span>
              ) : null}
            </button>
          );
        })}
        {overflow > 0 ? (
          <p className="px-2 pt-1 text-[11px] text-muted-foreground">
            {t("digitalMarketing.tiktokShop.dashboard.moreShops", "+{{count}} more", {
              count: overflow,
            })}
          </p>
        ) : null}
        {!shopsPending && activeShops.length === 0 ? (
          <p className="px-2 text-xs text-muted-foreground">
            {t("digitalMarketing.tiktokShop.noShops", "No shops synced yet. Try Sync shops.")}
          </p>
        ) : null}
      </div>
    </nav>
  );
}
