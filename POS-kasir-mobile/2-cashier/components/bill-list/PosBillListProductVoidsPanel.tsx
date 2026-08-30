import { CheckCircle2 } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatStoreCheckoutRp } from "@/5-2-customer-visits/checkout/lib/catalogLabel";
import { POS_BILL_LIST_I18N } from "../../lib/posBillListCopy";
import type { PosLineVoid } from "../../hooks/usePosLineVoids";

type Props = {
  voids: PosLineVoid[];
  query: string;
};

export function PosBillListProductVoidsPanel({ voids, query }: Props) {
  const { t } = useAppTranslation();
  const needle = query.trim().toLowerCase();
  const filtered = voids.filter((row) => {
    if (!needle) return true;
    return [row.product_name, row.reason, row.voided_by_name ?? ""]
      .join(" ")
      .toLowerCase()
      .includes(needle);
  });

  if (filtered.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <p className="text-center text-sm text-slate-400">
          {t(POS_BILL_LIST_I18N.emptyVoids, "No product cancellations yet.")}
        </p>
      </div>
    );
  }

  return (
    <div className="scrollbar-hide overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wide text-slate-800">
            <th className="px-3 py-2">{t(POS_BILL_LIST_I18N.colProduct, "Product")}</th>
            <th className="px-3 py-2">{t(POS_BILL_LIST_I18N.colQty, "Qty")}</th>
            <th className="px-3 py-2">{t(POS_BILL_LIST_I18N.colWaiter, "Waiter")}</th>
            <th className="px-3 py-2">{t(POS_BILL_LIST_I18N.colReason, "Reason")}</th>
            <th className="px-3 py-2 text-center">{t(POS_BILL_LIST_I18N.colSync, "Sync")}</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((row) => (
            <tr key={row.id} className="border-b border-slate-100">
              <td className="px-3 py-2.5">
                <p className="font-medium text-slate-900">{row.product_name}</p>
                <p className="text-xs text-slate-500">
                  {formatStoreCheckoutRp(row.unit_price)}
                </p>
              </td>
              <td className="px-3 py-2.5 text-slate-700">{row.quantity}</td>
              <td className="px-3 py-2.5 text-slate-700">{row.voided_by_name ?? "—"}</td>
              <td className="max-w-[200px] truncate px-3 py-2.5 text-slate-600">
                {row.reason}
              </td>
              <td className="px-3 py-2.5 text-center">
                <CheckCircle2
                  className="mx-auto h-5 w-5 text-emerald-500"
                  aria-label={t(POS_BILL_LIST_I18N.synced, "Synced")}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
