import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { formatToRupiah } from "@/shared/utils/formatCurrency";
import { formatGatewaySyncedAtLabel } from "@/shared/utils/formatGatewaySyncedAt";
import type { XenditWalletAggregate } from "@/xendit/types/xendit";

type XenditAggregateBalanceCardProps = {
  aggregate: XenditWalletAggregate;
  subAccountCount?: number;
  loading?: boolean;
  syncedAt?: string | null;
  syncing?: boolean;
  syncError?: string | null;
};

export function XenditAggregateBalanceCard({
  aggregate,
  subAccountCount = 0,
  loading = false,
  syncedAt = null,
  syncing = false,
  syncError = null,
}: XenditAggregateBalanceCardProps) {
  const { t } = useTranslation();
  const showPending = !loading && !syncing && aggregate.pendingBalance > 0;
  const showBalance = !loading && !syncing;

  return (
    <div className="rounded-xl border border-border bg-muted/30 px-5 py-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">
            {t("xendit.subAccount.aggregateTitle", "Total saldo Xendit")}
            {subAccountCount > 1
              ? ` · ${t("xendit.subAccount.aggregateHint", "{{count}} akun aktif", { count: subAccountCount })}`
              : null}
          </p>
          <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-foreground">
            {showBalance ? formatToRupiah(aggregate.usableBalance) : "…"}
          </p>
          {syncError ? (
            <p className="mt-1 text-xs text-destructive">{syncError}</p>
          ) : syncing ? (
            <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-xs">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t("xendit.finance.syncingBalance", "Menyinkronkan saldo…")}
            </p>
          ) : (
            <p className="text-muted-foreground mt-1 text-xs">
              {formatGatewaySyncedAtLabel(syncedAt ?? aggregate.syncedAt, t)}
            </p>
          )}
        </div>
        {showPending ? (
          <p className="text-xs text-muted-foreground">
            {t("xendit.finance.pendingBalance", "Pending")}{" "}
            {formatToRupiah(aggregate.pendingBalance)}
          </p>
        ) : null}
      </div>
    </div>
  );
}
