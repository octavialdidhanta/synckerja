import type { ReactNode } from "react";
import { Building2, ImageIcon, LayoutGrid, Megaphone, Settings, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/utils";
import type { TikTokAdsMetricEntity } from "@/tiktok-ads/hooks/useTikTokAdsMetricsQuery";

export type TikTokAdsNavAccount = {
  id: string;
  label: string | null;
  advertiser_id: string;
  is_default: boolean | null;
};

type NavItemDef = {
  id: TikTokAdsMetricEntity;
  labelKey: string;
  defaultLabel: string;
  icon: LucideIcon;
};

const ENTITY_ITEMS: NavItemDef[] = [
  {
    id: "campaign",
    labelKey: "digitalMarketing.tiktokAds.navCampaigns",
    defaultLabel: "Campaigns",
    icon: Megaphone,
  },
  {
    id: "adgroup",
    labelKey: "digitalMarketing.tiktokAds.navAdgroups",
    defaultLabel: "Ad groups",
    icon: LayoutGrid,
  },
  {
    id: "ad",
    labelKey: "digitalMarketing.tiktokAds.navAds",
    defaultLabel: "Ads",
    icon: ImageIcon,
  },
];

const ACCOUNT_NAV_MAX_VISIBLE = 5;

function navItemClassName(isActive: boolean) {
  return cn(
    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
    "disabled:cursor-not-allowed disabled:opacity-50",
    isActive
      ? "bg-gray-200/80 font-medium text-gray-900"
      : "text-gray-700 hover:bg-gray-100",
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-1 px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  );
}

type TikTokAdsEntityNavProps = {
  entity: TikTokAdsMetricEntity;
  onEntityChange: (entity: TikTokAdsMetricEntity) => void;
  className?: string;
  accounts: TikTokAdsNavAccount[];
  advertiserId: string;
  accountSelectReady: boolean;
  accountsPending: boolean;
  onAdvertiserIdChange: (advertiserId: string) => void;
  settingsActive?: boolean;
  onSettingsSelect?: () => void;
};

export function TikTokAdsEntityNav({
  entity,
  onEntityChange,
  className,
  accounts,
  advertiserId,
  accountSelectReady,
  accountsPending,
  onAdvertiserIdChange,
  settingsActive,
  onSettingsSelect,
}: TikTokAdsEntityNavProps) {
  const { t } = useTranslation();

  return (
    <nav
      className={cn(
        "flex w-[180px] shrink-0 flex-col self-stretch border-r border-gray-200 bg-gray-50/80",
        className,
      )}
      aria-label={t("digitalMarketing.tiktokAds.entityNavAria", "TikTok Ads report navigation")}
    >
      <div className="border-b border-gray-200 px-2 py-2">
        <SectionLabel>
          {t("digitalMarketing.tiktokAds.navSectionAccounts", "Advertisers")}
        </SectionLabel>

        {accountsPending ? (
          <ul className="space-y-0.5" aria-busy="true">
            <li className="h-8 animate-pulse rounded-md bg-gray-100" />
            <li className="h-8 animate-pulse rounded-md bg-gray-100" />
          </ul>
        ) : accounts.length === 0 ? (
          <p className="px-2 text-xs text-muted-foreground">
            {t("digitalMarketing.tiktokAds.filterNoAccounts", "No advertisers found.")}
          </p>
        ) : (
          <ul
            className={cn(
              "space-y-0.5",
              accounts.length > ACCOUNT_NAV_MAX_VISIBLE &&
                "scrollbar-hide max-h-[140px] overflow-y-auto",
            )}
            role="list"
          >
            {accounts.map((a) => {
              const isActive = advertiserId === a.advertiser_id;
              const name = a.label || a.advertiser_id;
              const canSelect = accountSelectReady;
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    disabled={!canSelect}
                    className={navItemClassName(isActive)}
                    aria-current={isActive ? "true" : undefined}
                    onClick={() => onAdvertiserIdChange(a.advertiser_id)}
                  >
                    <Building2 className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="border-t border-gray-200 px-2 py-2">
        <SectionLabel>
          {t("digitalMarketing.tiktokAds.navSectionCampaigns", "Campaigns")}
        </SectionLabel>
        <ul className="space-y-0.5" role="list">
          {ENTITY_ITEMS.map((item) => {
            const label = t(item.labelKey, item.defaultLabel);
            const isActive = !settingsActive && entity === item.id;
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={navItemClassName(isActive)}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => onEntityChange(item.id)}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
                  <span className="truncate">{label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {onSettingsSelect ? (
        <div className="mt-auto border-t border-gray-200 px-2 py-2">
          <ul className="space-y-0.5" role="list">
            <li>
              <button
                type="button"
                className={navItemClassName(settingsActive === true)}
                aria-current={settingsActive ? "page" : undefined}
                onClick={onSettingsSelect}
              >
                <Settings className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
                <span className="truncate">
                  {t("digitalMarketing.tiktokAds.navSettings", "Settings")}
                </span>
              </button>
            </li>
          </ul>
        </div>
      ) : null}
    </nav>
  );
}
