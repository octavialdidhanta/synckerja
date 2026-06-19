import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { formatToRupiah } from "@/shared/utils/formatCurrency";

type Props = {
  usableBalance: number;
  pendingBalance: number;
  totalBalance: number;
  loading: boolean;
  syncError?: string | null;
};

export function XenditFinanceBalanceCard({
  usableBalance,
  pendingBalance,
  totalBalance,
  loading,
  syncError,
}: Props) {
  const { t } = useTranslation();

  return (
    <div className="rounded-lg border border-gray-200 bg-gradient-to-br from-white to-gray-50/80 p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {t("xendit.finance.balanceLabel", "Saldo tersedia (CASH)")}
      </p>
      <p className="mt-1 text-3xl font-bold tabular-nums text-gray-900">
        {loading ? (
          <span className="inline-flex items-center gap-2 text-lg font-normal text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            {t("common.loading", "Loading…")}
          </span>
        ) : (
          formatToRupiah(usableBalance)
        )}
      </p>
      {!loading && pendingBalance > 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {t("xendit.finance.pendingBalance", "Pending (HOLDING)")}: {formatToRupiah(pendingBalance)}
          {" · "}
          {t("xendit.finance.totalBalance", "Total")}: {formatToRupiah(totalBalance)}
        </p>
      ) : null}
      {syncError ? (
        <p className="mt-2 text-sm text-destructive">{syncError}</p>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          {t(
            "xendit.finance.balanceHint",
            "Saldo CASH live akun xenPlatform (bukan akun master).",
          )}
        </p>
      )}
    </div>
  );
}
