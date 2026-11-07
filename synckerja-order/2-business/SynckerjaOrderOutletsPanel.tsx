import { Input } from "@/shared/components/ui/input";
import { Switch } from "@/shared/components/ui/switch";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { buildOrderStoreUrl } from "@/synckerja-order/shared/lib/orderUrls";
import {
  OutletWhatsAppMessageInput,
  OutletWhatsAppSelect,
  resolveOutletWhatsAppAccountId,
  type OrderWhatsAppAccountOption,
  type OutletWhatsAppPatch,
  type OutletWhatsAppSettings,
} from "@/synckerja-order/6-whatsapp";
import type { SynckerjaOrderOutletRow } from "../5-backoffice-shell/hooks/useSynckerjaOrderOutlets";

export type SynckerjaOrderOutletsWhatsApp = {
  accounts: OrderWhatsAppAccountOption[];
  settingsFor: (outletId: string) => OutletWhatsAppSettings;
  onChange: (outletId: string, patch: OutletWhatsAppPatch) => void;
  onSaveMessage: (outletId: string, message: string) => Promise<void>;
};

type Props = {
  rows: SynckerjaOrderOutletRow[];
  onToggle: (outletId: string, enabled: boolean) => void;
  onCodeChange: (outletId: string, code: string) => void;
  whatsapp: SynckerjaOrderOutletsWhatsApp;
  busy?: boolean;
};

export function SynckerjaOrderOutletsPanel({ rows, onToggle, onCodeChange, whatsapp, busy }: Props) {
  const { t } = useAppTranslation();
  return (
    <div className="overflow-x-auto p-3">
      <table className="w-full min-w-[1180px] text-left text-sm">
        <thead>
          <tr className="border-b text-muted-foreground">
            <th className="py-2 pr-3 font-medium">
              {t("synckerjaOrder.outlets.name", "Outlet")}
            </th>
            <th className="py-2 pr-3 font-medium">
              {t("synckerjaOrder.outlets.code", "Public code")}
            </th>
            <th className="py-2 pr-3 font-medium">
              {t("synckerjaOrder.outlets.url", "URL")}
            </th>
            <th className="py-2 pr-3 font-medium">
              {t("synckerjaOrder.outlets.enabled", "Enabled")}
            </th>
            <th className="py-2 pr-3 font-medium">
              {t("synckerjaOrder.whatsapp.column", "WhatsApp")}
            </th>
            <th className="py-2 font-medium">
              {t("synckerjaOrder.whatsapp.message", "Opening message")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const wa = whatsapp.settingsFor(row.id);
            const hasNumber = Boolean(
              resolveOutletWhatsAppAccountId({
                buttonEnabled: wa.buttonEnabled,
                selectedAccountId: wa.accountId,
                accounts: whatsapp.accounts,
              }),
            );
            return (
            <tr key={row.id} className="border-b last:border-0 align-top">
              <td className="py-2 pr-3">{row.name}</td>
              <td className="py-2 pr-3">
                <Input
                  className="h-8 w-28 font-mono"
                  value={row.public_code ?? ""}
                  maxLength={6}
                  disabled={busy}
                  onChange={(e) => onCodeChange(row.id, e.target.value.toLowerCase())}
                />
              </td>
              <td className="py-2 pr-3 font-mono text-xs text-primary">
                {row.public_code ? buildOrderStoreUrl(row.public_code) : "—"}
              </td>
              <td className="py-2 pr-3">
                <Switch
                  checked={row.enabled}
                  disabled={busy || !row.is_active}
                  onCheckedChange={(v) => onToggle(row.id, v)}
                />
              </td>
              <td className="py-2 pr-3">
                <OutletWhatsAppSelect
                  accounts={whatsapp.accounts}
                  settings={wa}
                  onChange={(patch) => whatsapp.onChange(row.id, patch)}
                />
              </td>
              <td className="py-2">
                <OutletWhatsAppMessageInput
                  value={wa.prefillMessage}
                  disabled={!hasNumber}
                  onSave={(message) => whatsapp.onSaveMessage(row.id, message)}
                />
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
