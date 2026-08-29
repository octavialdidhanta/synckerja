import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

export const OUTLETS_LIST_PATH = "/operations/settings/outlets-list";
export const SETTINGS_CHECKOUT_PATH = "/operations/settings/checkout";
export const SETTINGS_RECEIPT_PATH = "/operations/settings/receipt";
export const EMAIL_NOTIFICATIONS_PATH = "/operations/settings/email-notifications";
export const INVENTORY_SETTINGS_PATH = "/operations/settings/inventory";
export const SETTINGS_BANK_ACCOUNT_PATH = "/operations/settings/bank-account";

export function OutletsHeaderAndTab() {
  const { t } = useAppTranslation();
  const title = t("outlets.header.title", "Settings");

  return (
    <div className="px-1 py-3">
      <h1 className="mb-0.5 text-xl font-bold text-foreground">{title}</h1>
      <p className="text-xs text-muted-foreground">
        {t("outlets.header.subtitle", "Manage POS outlets and checkout")}
      </p>
    </div>
  );
}

OutletsHeaderAndTab.displayName = "OutletsHeaderAndTab";
