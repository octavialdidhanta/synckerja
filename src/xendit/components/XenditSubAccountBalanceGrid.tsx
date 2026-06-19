import { useTranslation } from "react-i18next";
import { Badge } from "@/shared/components/ui/badge";
import { formatToRupiah } from "@/shared/utils/formatCurrency";
import type { XenditSubAccountWallet } from "@/xendit/types/xendit";
import { cn } from "@/shared/lib/utils";

type XenditSubAccountBalanceGridProps = {
  wallets: XenditSubAccountWallet[];
  loading?: boolean;
};

function walletTitle(wallet: XenditSubAccountWallet): string {
  const business = wallet.business_name?.trim();
  const email = wallet.email?.trim();
  return business || email || wallet.xendit_sub_account_id || "—";
}

function walletSubtitle(wallet: XenditSubAccountWallet): string | null {
  const business = wallet.business_name?.trim();
  const email = wallet.email?.trim();
  if (business && email) return email;
  return null;
}

export function XenditSubAccountBalanceGrid({
  wallets,
  loading = false,
}: XenditSubAccountBalanceGridProps) {
  const { t } = useTranslation();

  if (!loading && wallets.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        {t(
          "xendit.subAccount.noWallets",
          "Belum ada data saldo per akun. Klik refresh untuk sinkronisasi.",
        )}
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <th className="px-3 py-2 font-medium">{t("xendit.history.colSubAccount", "Akun")}</th>
            <th className="px-3 py-2 text-right font-medium">
              {t("xendit.finance.balanceLabel", "Saldo tersedia")}
            </th>
          </tr>
        </thead>
        <tbody>
          {wallets.map((wallet) => {
            const subtitle = walletSubtitle(wallet);
            const showPending = !loading && wallet.pending_balance > 0;

            return (
              <tr
                key={wallet.id}
                className={cn(
                  "border-b border-border/60 last:border-0",
                  wallet.is_primary && "bg-primary/[0.03]",
                )}
              >
                <td className="px-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{walletTitle(wallet)}</p>
                      {subtitle ? (
                        <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
                      ) : null}
                    </div>
                    {wallet.is_primary ? (
                      <Badge variant="secondary" className="shrink-0 text-[10px]">
                        {t("xendit.subAccount.primaryBadge", "Utama")}
                      </Badge>
                    ) : null}
                  </div>
                  {wallet.sync_error ? (
                    <p className="mt-0.5 text-[11px] text-destructive line-clamp-1">
                      {wallet.sync_error}
                    </p>
                  ) : null}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  <p className="font-semibold text-foreground">
                    {loading ? "…" : formatToRupiah(wallet.usable_balance)}
                  </p>
                  {showPending ? (
                    <p className="text-[11px] text-muted-foreground">
                      {t("xendit.finance.pendingBalance", "Pending")}{" "}
                      {formatToRupiah(wallet.pending_balance)}
                    </p>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
