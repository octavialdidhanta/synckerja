import type { ReactNode } from "react";
import { Building2, ImageIcon, LayoutGrid, Megaphone, Settings, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/utils";
import type { MetaAdsMetricEntity } from "@/meta-ads/hooks/useMetaAdsMetricsQuery";

export type MetaAdsNavAccount = {
  id: string;
  label: string | null;
  ad_account_id: string;
  is_default: boolean | null;
  /** False when pixel_id is still placeholder "0" — account visible but metrics disabled. */
  metricsReady: boolean;
};

type NavItemDef = {
  id: MetaAdsMetricEntity;
  labelKey: string;
  defaultLabel: string;
  icon: LucideIcon;
};

const ENTITY_ITEMS: NavItemDef[] = [
  {
    id: "campaign",
    labelKey: "digitalMarketing.metaAds.navCampaigns",
    defaultLabel: "Campaigns",
    icon: Megaphone,
  },
  {
    id: "adset",
    labelKey: "digitalMarketing.metaAds.navAdsets",
    defaultLabel: "Ad sets",
    icon: LayoutGrid,
  },
  {
    id: "ad",
    labelKey: "digitalMarketing.metaAds.navAds",
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

type MetaAdsEntityNavProps = {
  entity: MetaAdsMetricEntity;
  onEntityChange: (entity: MetaAdsMetricEntity) => void;
  className?: string;
  accounts: MetaAdsNavAccount[];
  adAccountId: string;
  accountSelectReady: boolean;
  accountsPending: boolean;
  onAdAccountIdChange: (adAccountId: string) => void;
  settingsActive?: boolean;
  onSettingsSelect?: () => void;
};

export function MetaAdsEntityNav({
  entity,
  onEntityChange,
  className,
  accounts,
  adAccountId,
  accountSelectReady,
  accountsPending,
  onAdAccountIdChange,
  settingsActive,
  onSettingsSelect,
}: MetaAdsEntityNavProps) {
  const { t } = useTranslation();

  return (
    <nav
      className={cn(
        "flex w-[180px] shrink-0 flex-col self-stretch border-r border-gray-200 bg-gray-50/80",
        className,
      )}
      aria-label={t("digitalMarketing.metaAds.entityNavAria", "Meta Ads report navigation")}
    >
      <div className="border-b border-gray-200 px-2 py-2">
        <SectionLabel>
          {t("digitalMarketing.metaAds.navSectionAccounts", "Accounts")}
        </SectionLabel>

        {accountsPending ? (
          <ul className="space-y-0.5" aria-busy="true">
            <li className="h-8 animate-pulse rounded-md bg-gray-100" />
            <li className="h-8 animate-pulse rounded-md bg-gray-100" />
          </ul>
        ) : accounts.length === 0 ? (
          <p className="px-2 text-xs text-muted-foreground">
            {t("digitalMarketing.metaAds.filterNoAccounts", "No accounts found.")}
          </p>
        ) : accounts.every((a) => !a.metricsReady) ? (
          <div className="space-y-1">
            <p className="px-2 text-xs text-amber-700">
              {t(
                "digitalMarketing.metaAds.navPixelRequired",
                "Set a Pixel ID in Settings for each account to load metrics.",
              )}
            </p>
            <ul className="space-y-0.5" role="list">
              {accounts.map((a) => {
                const name = a.label || a.ad_account_id;
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      disabled
                      className={navItemClassName(false)}
                      title={t(
                        "digitalMarketing.metaAds.navPixelRequiredAccount",
                        "Edit this account and enter your Meta Pixel ID from Events Manager.",
                      )}
                    >
                      <Building2 className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
                      <span className="min-w-0 flex-1 truncate opacity-70">{name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
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
              const isActive = adAccountId === a.ad_account_id && a.metricsReady;
              const name = a.label || a.ad_account_id;
              const canSelect = accountSelectReady && a.metricsReady;
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    disabled={!canSelect}
                    className={navItemClassName(isActive)}
                    aria-current={isActive ? "true" : undefined}
                    title={
                      !a.metricsReady
                        ? t(
                            "digitalMarketing.metaAds.navPixelRequiredAccount",
                            "Edit this account and enter your Meta Pixel ID from Events Manager.",
                          )
                        : undefined
                    }
                    onClick={() => onAdAccountIdChange(a.ad_account_id)}
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
          {t("digitalMarketing.metaAds.navSectionCampaigns", "Campaigns")}
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
                  {t("digitalMarketing.metaAds.navSettings", "Settings")}
                </span>
              </button>
            </li>
          </ul>
        </div>
      ) : null}
    </nav>
  );
}
