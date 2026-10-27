import { useEffect, useState } from "react";
import { BookOpen, Building2, Clock, Contact, QrCode, Store, UserRound } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useHeaderTabPageAccess } from "@/shared/auth/page-access/useHeaderTabPageAccess";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { SYNCKERJA_ORDER_I18N } from "@/synckerja-order/shared/lib/orderCopy";
import {
  synckerjaOrderTabFromPathname,
  synckerjaOrderTabLocation,
  synckerjaOrderTabPath,
  type SynckerjaOrderSubTab,
} from "../lib/synckerjaOrderTabs";

const tabs: Array<{
  id: SynckerjaOrderSubTab;
  titleKey: string;
  fallbackTitle: string;
  icon: typeof Store;
}> = [
  {
    id: "profile",
    titleKey: SYNCKERJA_ORDER_I18N.tabProfile,
    fallbackTitle: "Profile",
    icon: UserRound,
  },
  {
    id: "contact",
    titleKey: SYNCKERJA_ORDER_I18N.tabContact,
    fallbackTitle: "Contact",
    icon: Contact,
  },
  {
    id: "terms",
    titleKey: SYNCKERJA_ORDER_I18N.tabTerms,
    fallbackTitle: "Terms",
    icon: BookOpen,
  },
  {
    id: "outlets",
    titleKey: SYNCKERJA_ORDER_I18N.tabOutlets,
    fallbackTitle: "Outlets",
    icon: Building2,
  },
  {
    id: "hours",
    titleKey: SYNCKERJA_ORDER_I18N.tabHours,
    fallbackTitle: "Hours",
    icon: Clock,
  },
  {
    id: "catalog",
    titleKey: SYNCKERJA_ORDER_I18N.tabCatalog,
    fallbackTitle: "Catalog",
    icon: Store,
  },
  {
    id: "qr",
    titleKey: SYNCKERJA_ORDER_I18N.tabQr,
    fallbackTitle: "QR",
    icon: QrCode,
  },
];

type Props = {
  businessName?: string;
  onSave?: () => void;
  saveBusy?: boolean;
  onViewStore?: () => void;
};

export function SynckerjaOrderHeaderAndTab({
  businessName,
  onSave,
  saveBusy,
  onViewStore,
}: Props) {
  const { t } = useAppTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { isTabLocked } = useHeaderTabPageAccess();
  const pathTab = synckerjaOrderTabFromPathname(location.pathname);
  const [pendingTab, setPendingTab] = useState<SynckerjaOrderSubTab | null>(null);
  const activeTab = pendingTab ?? pathTab;

  useEffect(() => {
    if (pendingTab && pendingTab === pathTab) setPendingTab(null);
  }, [pendingTab, pathTab]);

  const goToTab = (tabId: SynckerjaOrderSubTab) => {
    const path = synckerjaOrderTabPath(tabId);
    if (isTabLocked(path) || tabId === activeTab) return;
    setPendingTab(tabId);
    navigate(synckerjaOrderTabLocation(path, location.search), { preventScrollReset: true });
  };

  const title = businessName?.trim() || t(SYNCKERJA_ORDER_I18N.headerTitle, "Synckerja Order");

  return (
    <div className="flex items-start justify-between gap-3 px-1 pt-1 pb-0">
      <div className="min-w-0 flex-1">
        <h1 className="mb-1.5 flex h-10 items-center whitespace-nowrap text-xl font-bold leading-none text-foreground">
          {title}
        </h1>
        <nav className="flex flex-wrap gap-x-6 gap-y-1" aria-label={title} role="tablist">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const path = synckerjaOrderTabPath(tab.id);
            const isActive = activeTab === tab.id;
            const locked = isTabLocked(path);
            const label = t(tab.titleKey, tab.fallbackTitle);

            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                disabled={locked}
                onClick={() => goToTab(tab.id)}
                className={`flex items-center space-x-1.5 border-b-2 bg-transparent px-1 py-1.5 text-sm font-medium transition-colors ${
                  locked
                    ? "cursor-not-allowed border-transparent text-muted-foreground opacity-60"
                    : isActive
                      ? "cursor-pointer border-primary text-primary"
                      : "cursor-pointer border-transparent text-muted-foreground hover:border-primary/30 hover:text-foreground"
                }`}
                style={{ borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>
      </div>
      <div className="flex shrink-0 items-center gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          className="h-10 shrink-0"
          onClick={onViewStore}
          disabled={!onViewStore}
        >
          {t(SYNCKERJA_ORDER_I18N.viewStore, "View store")}
        </Button>
        <Button
          type="button"
          className="h-10 shrink-0"
          onClick={onSave}
          disabled={!onSave || saveBusy}
        >
          {t(SYNCKERJA_ORDER_I18N.saveContinue, "Save and continue")}
        </Button>
      </div>
    </div>
  );
}

SynckerjaOrderHeaderAndTab.displayName = "SynckerjaOrderHeaderAndTab";
