import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { SynckerjaOrderSubTab } from "../lib/synckerjaOrderTabs";

export const SYNCKERJA_ORDER_CONTACT_FIELD_COUNT = 4;

type Props = {
  tab: SynckerjaOrderSubTab;
  filledContactFields?: number;
};

export function SynckerjaOrderPanelFooter({ tab, filledContactFields = 0 }: Props) {
  const { t } = useAppTranslation();
  const total = SYNCKERJA_ORDER_CONTACT_FIELD_COUNT;

  const left =
    tab === "contact"
      ? t("synckerjaOrder.footer.contactShowing", "Showing {{filled}} of {{total}} contact fields", {
          filled: filledContactFields,
          total,
        })
      : t("synckerjaOrder.footer.section", "Guest menu settings");

  const right =
    tab === "contact"
      ? t("synckerjaOrder.footer.contactTotal", "Total: {{total}} fields", { total })
      : t("synckerjaOrder.footer.guestMenu", "Guest menu");

  return (
    <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{left}</span>
        <span className="text-xs text-muted-foreground/80">{right}</span>
      </div>
    </div>
  );
}
