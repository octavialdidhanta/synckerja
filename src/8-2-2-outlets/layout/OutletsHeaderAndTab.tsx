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
    <div className="px-1 pt-1 pb-0">
      <h1 className="flex h-10 items-center text-xl font-bold leading-none text-foreground">
        {title}
      </h1>
    </div>
  );
}

OutletsHeaderAndTab.displayName = "OutletsHeaderAndTab";
