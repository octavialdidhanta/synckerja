import QRCode from "react-qr-code";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { buildOrderStoreUrl } from "@/synckerja-order/shared/lib/orderUrls";
import type { SynckerjaOrderTableRow } from "../5-backoffice-shell/hooks/useSynckerjaOrderTables";

type Props = {
  publicCode: string | null;
  tables: SynckerjaOrderTableRow[];
};

export function SynckerjaOrderQrPanel({ publicCode, tables }: Props) {
  const { t } = useAppTranslation();
  if (!publicCode) {
    return (
      <p className="p-4 text-sm text-muted-foreground">
        {t("synckerjaOrder.qr.needCode", "Set a public code on the Outlets tab first.")}
      </p>
    );
  }
  return (
    <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
      {tables.map((table) => {
        const url = buildOrderStoreUrl(publicCode, {
          mode: "dinein",
          tableNumber: table.name,
        });
        return (
          <div key={table.id} className="rounded-lg border border-border bg-card p-4 text-center">
            <p className="mb-2 text-sm font-semibold">{table.name}</p>
            <div className="mx-auto w-32 bg-white p-2">
              <QRCode value={url} size={112} />
            </div>
            <p className="mt-2 break-all font-mono text-[10px] text-muted-foreground">{url}</p>
          </div>
        );
      })}
    </div>
  );
}
