import type { ReactNode } from "react";
import {
  Building2,
  ImageIcon,
  KeyRound,
  LayoutGrid,
  Megaphone,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/utils";
import type { GoogleAdsMetricEntity } from "@/google-ads/metrics/types";

export type GoogleAdsNavAccount = {
  id: string;
  label: string | null;
  customer_id: string;
  is_default: boolean | null;
};

type NavItemDef = {
  id: GoogleAdsMetricEntity;
  labelKey: string;
  defaultLabel: string;
  icon: LucideIcon;
};

type NavGroupDef = {
  id: string;
  sectionKey: string;
  sectionDefault: string;
  items: NavItemDef[];
};

const NAV_GROUPS: NavGroupDef[] = [
  {
    id: "report",
    sectionKey: "digitalMarketing.googleAds.navSectionCampaigns",
    sectionDefault: "Campaigns",
    items: [
      {
        id: "campaign",
        labelKey: "digitalMarketing.googleAds.navCampaigns",
        defaultLabel: "Campaigns",
        icon: Megaphone,
      },
      {
        id: "ad_group",
        labelKey: "digitalMarketing.googleAds.navAdGroups",
        defaultLabel: "Ad groups",
        icon: LayoutGrid,
      },
      {
        id: "ad",
        labelKey: "digitalMarketing.googleAds.navAds",
        defaultLabel: "Ads",
        icon: ImageIcon,
      },
    ],
  },
  {
    id: "targeting",
    sectionKey: "digitalMarketing.googleAds.navSectionTargeting",
    sectionDefault: "Targeting",
    items: [
      {
        id: "keyword",
        labelKey: "digitalMarketing.googleAds.navKeywords",
        defaultLabel: "Keywords",
        icon: KeyRound,
      },
    ],
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

type GoogleAdsEntityNavProps = {
  entity: GoogleAdsMetricEntity;
  onEntityChange: (entity: GoogleAdsMetricEntity) => void;
  className?: string;
  accounts: GoogleAdsNavAccount[];
  customerId: string;
  customerSelectReady: boolean;
  accountsPending: boolean;
  onCustomerIdChange: (customerId: string) => void;
};

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-1 px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  );
}

function GoogleAdsAccountSelector({
  accounts,
  customerId,
  customerSelectReady,
  accountsPending,
  onCustomerIdChange,
}: Pick<
  GoogleAdsEntityNavProps,
  "accounts" | "customerId" | "customerSelectReady" | "accountsPending" | "onCustomerIdChange"
>) {
  const { t } = useTranslation();

  return (
    <div className="border-b border-gray-200 px-2 py-2">
      <SectionLabel>
        {t("digitalMarketing.googleAds.navSectionAccounts", "Accounts")}
      </SectionLabel>

      {accountsPending ? (
        <ul className="space-y-0.5" aria-busy="true">
          <li className="h-8 animate-pulse rounded-md bg-gray-100" />
          <li className="h-8 animate-pulse rounded-md bg-gray-100" />
        </ul>
      ) : accounts.length === 0 ? (
        <p className="px-2 text-xs text-muted-foreground">
          {t("digitalMarketing.googleAds.filterNoAccounts", "No accounts found.")}
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
            const isActive = customerId === a.customer_id;
            const name = a.label || a.customer_id;
            return (
              <li key={a.id}>
                <button
                  type="button"
                  disabled={!customerSelectReady}
                  className={navItemClassName(isActive)}
                  aria-current={isActive ? "true" : undefined}
                  onClick={() => onCustomerIdChange(a.customer_id)}
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
  );
}

function NavGroupSection({
  group,
  entity,
  onEntityChange,
  showTopBorder,
}: {
  group: NavGroupDef;
  entity: GoogleAdsMetricEntity;
  onEntityChange: (entity: GoogleAdsMetricEntity) => void;
  showTopBorder?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div className={cn("px-2 py-2", showTopBorder && "border-t border-gray-200")}>
      <SectionLabel>{t(group.sectionKey, group.sectionDefault)}</SectionLabel>
      <ul className="space-y-0.5" role="list">
        {group.items.map((item) => {
          const label = t(item.labelKey, item.defaultLabel);
          const isActive = entity === item.id;
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
  );
}

export function GoogleAdsEntityNav({
  entity,
  onEntityChange,
  className,
  accounts,
  customerId,
  customerSelectReady,
  accountsPending,
  onCustomerIdChange,
}: GoogleAdsEntityNavProps) {
  const { t } = useTranslation();

  return (
    <nav
      className={cn(
        "flex w-[180px] shrink-0 flex-col self-stretch border-r border-gray-200 bg-gray-50/80",
        className,
      )}
      aria-label={t("digitalMarketing.googleAds.entityNavAria", "Google Ads report navigation")}
    >
      <GoogleAdsAccountSelector
        accounts={accounts}
        customerId={customerId}
        customerSelectReady={customerSelectReady}
        accountsPending={accountsPending}
        onCustomerIdChange={onCustomerIdChange}
      />
      {NAV_GROUPS.map((group, index) => (
        <NavGroupSection
          key={group.id}
          group={group}
          entity={entity}
          onEntityChange={onEntityChange}
          showTopBorder={index > 0}
        />
      ))}
    </nav>
  );
}
