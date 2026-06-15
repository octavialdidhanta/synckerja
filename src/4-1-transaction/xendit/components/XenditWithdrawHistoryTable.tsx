import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/shared/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { formatToRupiah } from "@/shared/utils/formatCurrency";
import { fetchGatewayWithdrawals } from "@/xendit/lib/xenditApi";
import type { XenditGatewayWithdrawalRow } from "@/xendit/lib/xenditApi";
import { useCanAllocateIncome } from "@/4-1-dashboard/hooks/useCanAllocateIncome";

type Props = {
  organizationId: string | null | undefined;
  enabled: boolean;
};

function statusVariant(status: string): "default" | "secondary" | "destructive" {
  if (status === "completed") return "default";
  if (status === "failed") return "destructive";
  return "secondary";
}

function useWithdrawalStatusLabel(status: string): string {
  const { t } = useTranslation();
  if (status === "completed") return t("xendit.finance.statusSuccess", "BERHASIL");
  if (status === "failed") return t("xendit.finance.statusFailed", "GAGAL");
  return t("xendit.finance.statusProcessing", "PROSES");
}

function WithdrawalStatusBadge({ status }: { status: string }) {
  const label = useWithdrawalStatusLabel(status);
  return (
    <Badge variant={statusVariant(status)} className="text-[10px] uppercase">
      {label}
    </Badge>
  );
}

export function XenditWithdrawHistoryTable({ organizationId, enabled }: Props) {
  const { t } = useTranslation();
  const { canAllocateIncome } = useCanAllocateIncome();

  const { data: historyData, isLoading } = useQuery({
    queryKey: ["xendit-gateway-withdrawals", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const res = await fetchGatewayWithdrawals(organizationId, 20);
      return res.withdrawals ?? [];
    },
    enabled: Boolean(organizationId && enabled),
    staleTime: 15_000,
  });

  const rows = (historyData ?? []) as XenditGatewayWithdrawalRow[];

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-900">
        {t("xendit.finance.historyTitle", "Riwayat penarikan")}
      </h3>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading", "Loading…")}</p>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-muted-foreground">
          {t("xendit.finance.historyEmpty", "Belum ada penarikan.")}
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">
                  {t("xendit.finance.colDate", "Tanggal")}
                </TableHead>
                <TableHead className="text-xs">
                  {t("xendit.finance.colAmount", "Nominal")}
                </TableHead>
                <TableHead className="text-xs">
                  {t("xendit.finance.colBank", "Bank tujuan")}
                </TableHead>
                <TableHead className="text-xs">
                  {t("xendit.finance.colStatus", "Status")}
                </TableHead>
                {canAllocateIncome ? (
                  <TableHead className="text-xs">
                    {t("xendit.finance.colInitiator", "Pengaju")}
                  </TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-xs whitespace-nowrap">
                    {new Date(row.created_at).toLocaleString("id-ID")}
                  </TableCell>
                  <TableCell className="text-xs">
                    <p className="font-medium">{formatToRupiah(Number(row.amount))}</p>
                    {row.net_amount != null && row.platform_fee_amount ? (
                      <p className="text-[10px] text-muted-foreground">
                        {t("xendit.finance.netLine", "Bersih")}: {formatToRupiah(Number(row.net_amount))}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate text-xs">
                    {row.bank_destination ?? "—"}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <WithdrawalStatusBadge status={row.status} />
                      {row.status === "failed" && row.failure_message ? (
                        <p className="max-w-[200px] text-[10px] text-destructive line-clamp-2">
                          {row.failure_message}
                        </p>
                      ) : null}
                    </div>
                  </TableCell>
                  {canAllocateIncome ? (
                    <TableCell className="text-xs text-muted-foreground">
                      {row.initiated_by_name ?? "—"}
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
