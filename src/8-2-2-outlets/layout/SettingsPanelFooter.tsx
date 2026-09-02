import { useLocation } from "react-router-dom";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import {
  EMAIL_NOTIFICATIONS_PATH,
  INVENTORY_SETTINGS_PATH,
  SETTINGS_BANK_ACCOUNT_PATH,
  SETTINGS_CHECKOUT_PATH,
  SETTINGS_RECEIPT_PATH,
} from "./OutletsHeaderAndTab";
import { SETTINGS_SECTION_COUNT } from "./settingsLayout";

function sectionCopy(pathname: string): { key: string; fallback: string } {
  if (pathname.startsWith(SETTINGS_CHECKOUT_PATH)) {
    return { key: "outlets.nav.checkout", fallback: "Checkout" };
  }
  if (pathname.startsWith(SETTINGS_RECEIPT_PATH)) {
    return { key: "outlets.nav.receipt", fallback: "Receipt" };
  }
  if (pathname.startsWith(EMAIL_NOTIFICATIONS_PATH)) {
    return { key: "outlets.nav.emailNotifications", fallback: "Email Notification" };
  }
  if (pathname.startsWith(INVENTORY_SETTINGS_PATH)) {
    return { key: "outlets.nav.inventory", fallback: "Inventory" };
  }
  if (pathname.startsWith(SETTINGS_BANK_ACCOUNT_PATH)) {
    return { key: "outlets.nav.bankAccount", fallback: "Bank Account" };
  }
  return { key: "outlets.nav.outlet", fallback: "Outlet" };
}

export function SettingsPanelFooter() {
  const { t } = useAppTranslation();
  const { pathname } = useLocation();
  const section = sectionCopy(pathname);
  const sectionLabel = t(section.key, section.fallback);

  return (
    <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {t("outlets.footer.showing", "{{section}} settings", { section: sectionLabel })}
        </span>
        <span className="text-xs text-muted-foreground/80">
          {t("outlets.footer.total", "Total: {{count}} sections", { count: SETTINGS_SECTION_COUNT })}
        </span>
      </div>
    </div>
  );
}
