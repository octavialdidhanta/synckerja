import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import {
  ORDER_WHATSAPP_NONE,
  orderWhatsAppAccountLabel,
  resolveOutletWhatsAppAccountId,
  type OrderWhatsAppAccountOption,
} from "../lib/orderWhatsApp";
import type { OutletWhatsAppPatch, OutletWhatsAppSettings } from "../hooks/useSynckerjaOrderOutletWhatsApp";

type Props = {
  accounts: OrderWhatsAppAccountOption[];
  settings: OutletWhatsAppSettings;
  disabled?: boolean;
  onChange: (patch: OutletWhatsAppPatch) => void;
};

/** Per-outlet dropdown: which omnichannel WhatsApp number the storefront button opens. */
export function OutletWhatsAppSelect({ accounts, settings, disabled, onChange }: Props) {
  const { t } = useAppTranslation();

  if (accounts.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">
        {t("synckerjaOrder.whatsapp.notConnected", "WhatsApp not connected")}
      </span>
    );
  }

  const effectiveId = resolveOutletWhatsAppAccountId({
    buttonEnabled: settings.buttonEnabled,
    selectedAccountId: settings.accountId,
    accounts,
  });
  const value = !settings.buttonEnabled ? ORDER_WHATSAPP_NONE : (effectiveId ?? "");

  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        if (next === value) return;
        if (next === ORDER_WHATSAPP_NONE) {
          onChange({ buttonEnabled: false });
        } else {
          onChange({ buttonEnabled: true, accountId: next });
        }
      }}
    >
      <SelectTrigger
        className="h-8 w-56 text-xs"
        aria-label={t("synckerjaOrder.whatsapp.column", "WhatsApp")}
      >
        <SelectValue placeholder={t("synckerjaOrder.whatsapp.placeholder", "Select WhatsApp")} />
      </SelectTrigger>
      <SelectContent>
        {accounts.map((account) => (
          <SelectItem key={account.id} value={account.id} className="text-xs">
            {orderWhatsAppAccountLabel(account)}
          </SelectItem>
        ))}
        <SelectSeparator />
        <SelectItem value={ORDER_WHATSAPP_NONE} className="text-xs text-muted-foreground">
          {t("synckerjaOrder.whatsapp.none", "No WhatsApp")}
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
