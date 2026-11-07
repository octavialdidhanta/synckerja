import { useState } from "react";
import { Check, Copy } from "lucide-react";
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
  onSaveMapsUrl: (outletId: string, mapsUrl: string) => Promise<void>;
};

type Props = {
  rows: SynckerjaOrderOutletRow[];
  onToggle: (outletId: string, enabled: boolean) => void;
  whatsapp: SynckerjaOrderOutletsWhatsApp;
  busy?: boolean;
};

export function SynckerjaOrderOutletsPanel({ rows, onToggle, whatsapp, busy }: Props) {
  const { t } = useAppTranslation();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyStoreUrl = async (outletId: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(outletId);
      window.setTimeout(() => {
        setCopiedId((current) => (current === outletId ? null : current));
      }, 1500);
    } catch {
      setCopiedId(null);
    }
  };

  return (
    <div className="overflow-x-auto p-3">
      <table className="w-full min-w-[960px] text-left text-sm">
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
            <th className="w-16 py-2 text-right font-medium">
              {t("synckerjaOrder.outlets.action", "Action")}
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
            const storeUrl = row.public_code
              ? buildOrderStoreUrl(row.public_code, { mode: "link" }, row.name)
              : null;
            return (
            <tr key={row.id} className="border-b last:border-0">
              <td className="py-2 pr-3 align-middle">{row.name}</td>
              <td className="py-2 pr-3 align-middle font-mono text-xs">
                {row.public_code ?? "—"}
              </td>
              <td className="py-2 pr-3 align-middle font-mono text-xs whitespace-nowrap">
                {storeUrl ? (
                  <span className="inline-flex items-center gap-1">
                    <a
                      href={storeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline-offset-2 hover:underline"
                    >
                      {storeUrl}
                    </a>
                    <button
                      type="button"
                      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                      aria-label={t("synckerjaOrder.outlets.copyUrl", "Copy URL")}
                      onClick={() => void copyStoreUrl(row.id, storeUrl)}
                    >
                      {copiedId === row.id ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </span>
                ) : (
                  "—"
                )}
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
              <td className="py-2 text-right">
                <div className="flex justify-end">
                  <OutletWhatsAppMessageInput
                    value={wa.prefillMessage}
                    disabled={!hasNumber}
                    onSave={(message) => whatsapp.onSaveMessage(row.id, message)}
                    linkOrderingEnabled={wa.linkOrderingEnabled}
                    onLinkOrderingChange={(enabled) =>
                      whatsapp.onChange(row.id, { linkOrderingEnabled: enabled })
                    }
                    mapsUrl={wa.mapsUrl}
                    onSaveMapsUrl={(url) => whatsapp.onSaveMapsUrl(row.id, url)}
                  />
                </div>
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
