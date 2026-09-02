import { Input } from "@/shared/components/ui/input";
import { Switch } from "@/shared/components/ui/switch";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { buildOrderStoreUrl } from "@/synckerja-order/shared/lib/orderUrls";
import type { SynckerjaOrderOutletRow } from "../5-backoffice-shell/hooks/useSynckerjaOrderOutlets";

type Props = {
  rows: SynckerjaOrderOutletRow[];
  onToggle: (outletId: string, enabled: boolean) => void;
  onCodeChange: (outletId: string, code: string) => void;
  busy?: boolean;
};

export function SynckerjaOrderOutletsPanel({ rows, onToggle, onCodeChange, busy }: Props) {
  const { t } = useAppTranslation();
  return (
    <div className="overflow-x-auto p-4">
      <table className="w-full min-w-[640px] text-left text-sm">
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
            <th className="py-2 font-medium">
              {t("synckerjaOrder.outlets.enabled", "Enabled")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b last:border-0">
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
              <td className="py-2">
                <Switch
                  checked={row.enabled}
                  disabled={busy || !row.is_active}
                  onCheckedChange={(v) => onToggle(row.id, v)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
