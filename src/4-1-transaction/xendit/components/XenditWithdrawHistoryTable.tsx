import { Loader2 } from "lucide-react";
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
import type { XenditGatewayWithdrawalRow } from "@/xendit/lib/xenditApi";
import { useCanAllocateIncome } from "@/4-1-dashboard/hooks/useCanAllocateIncome";
import { useXenditGatewayWithdrawals } from "@/4-1-transaction/xendit/hooks/useXenditGatewayWithdrawals";
import { XenditPanelFooter } from "@/4-1-transaction/xendit/components/XenditPanelFooter";
import { cn } from "@/shared/lib/utils";
import { XenditSubAccountLabel } from "@/xendit/components/XenditSubAccountLabel";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

type Props = {
  organizationId: string | null | undefined;
  enabled?: boolean;
  layout?: "embedded" | "page";
  maxRows?: number;
  hideTitle?: boolean;
  emptyMessage?: string;
  /** When provided (page route), parent owns the query — avoids duplicate hooks. */
  rows?: XenditGatewayWithdrawalRow[];
};

function statusVariant(status: string): "default" | "secondary" | "destructive" {
  if (status === "completed") return "default";
  if (status === "failed") return "destructive";
  return "secondary";
}

function useWithdrawalStatusLabel(status: string): string {
  const { t } = useAppTranslation();
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

export function XenditWithdrawHistoryTable({
  organizationId,
  enabled = true,
  layout = "embedded",
  maxRows,
  hideTitle = false,
  emptyMessage,
  rows: rowsProp,
}: Props) {
  const { t, dateLocale } = useAppTranslation();
  const { canAllocateIncome } = useCanAllocateIncome();
  const isPage = layout === "page";

  const { data: historyData, isLoading } = useXenditGatewayWithdrawals(
    organizationId,
    enabled && rowsProp == null,
    { limit: maxRows ?? 20 },
  );

  const allRows = (rowsProp ?? historyData ?? []) as XenditGatewayWithdrawalRow[];
  const rows =
    maxRows != null && maxRows > 0 ? allRows.slice(0, maxRows) : allRows;
  const emptyText = emptyMessage ?? t("xendit.finance.historyEmpty", "Belum ada penarikan.");

  if (isLoading && rowsProp == null && layout !== "page") {
    return (
      <div
        className={cn(
          "flex items-center justify-center text-sm text-muted-foreground",
          isPage ? "flex-1 py-6" : "py-6",
        )}
      >
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        {t("common.loading", "Memuat…")}
      </div>
    );
  }

  if (allRows.length === 0) {
    if (isPage) {
      return (
        <>
          <div className="flex flex-1 items-center justify-center p-6">
            <p className="text-center text-sm text-muted-foreground">{emptyText}</p>
          </div>
          <XenditPanelFooter
            left={t("xendit.finance.footerShowing", "Menampilkan {{count}} penarikan", { count: 0 })}
            right={t("xendit.finance.footerCount", "Total: {{count}}", { count: 0 })}
          />
        </>
      );
    }

    return (
      <div className="space-y-3">
        {!hideTitle ? (
          <h3 className="text-sm font-semibold text-gray-900">
            {t("xendit.finance.historyTitle", "Riwayat penarikan")}
          </h3>
        ) : null}
        <p className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-muted-foreground">
          {emptyText}
        </p>
      </div>
    );
  }

  const tableContent = (
    <Table className={cn(isPage && "min-w-[880px] table-fixed")}>
      <TableHeader className={cn(isPage && "sticky top-0 z-20 bg-gray-50 shadow-sm")}>
        <TableRow className={cn(isPage && "hover:bg-transparent")}>
          <TableHead className={cn("text-xs", isPage && "bg-gray-50 w-[140px]")}>
            {t("xendit.finance.colDate", "Tanggal")}
          </TableHead>
          <TableHead className={cn("text-xs", isPage && "bg-gray-50 w-[140px]")}>
            {t("xendit.finance.colAmount", "Nominal")}
          </TableHead>
          <TableHead className={cn("text-xs", isPage && "bg-gray-50 w-[160px]")}>
            {t("xendit.history.colSubAccount", "Akun")}
          </TableHead>
          <TableHead className={cn("text-xs", isPage && "bg-gray-50")}>
            {t("xendit.finance.colBank", "Bank tujuan")}
          </TableHead>
          <TableHead className={cn("text-xs", isPage && "bg-gray-50 w-[120px]")}>
            {t("xendit.finance.colStatus", "Status")}
          </TableHead>
          {canAllocateIncome ? (
            <TableHead className={cn("text-xs", isPage && "bg-gray-50 w-[120px]")}>
              {t("xendit.finance.colInitiator", "Pengaju")}
            </TableHead>
          ) : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="text-xs whitespace-nowrap">
              {new Date(row.created_at).toLocaleString(dateLocale)}
            </TableCell>
            <TableCell className="text-xs">
              <p className="font-medium">{formatToRupiah(Number(row.amount))}</p>
              {row.net_amount != null && row.platform_fee_amount ? (
                <p className="text-[10px] text-muted-foreground">
                  {t("xendit.finance.netLine", "Bersih")}: {formatToRupiah(Number(row.net_amount))}
                </p>
              ) : null}
            </TableCell>
            <TableCell className="text-xs">
              <XenditSubAccountLabel label={row.sub_account_label} compact />
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
  );

  if (isPage) {
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-auto seamless-scroll nested-scroll-touch-chain">
          {tableContent}
        </div>
        <XenditPanelFooter
          left={t("xendit.finance.footerShowing", "Menampilkan {{count}} penarikan", {
            count: rows.length,
          })}
          right={t("xendit.finance.footerCount", "Total: {{count}}", { count: rows.length })}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!hideTitle ? (
        <h3 className="text-sm font-semibold text-gray-900">
          {t("xendit.finance.historyTitle", "Riwayat penarikan")}
        </h3>
      ) : null}
      <div className="overflow-hidden rounded-lg border border-gray-200">{tableContent}</div>
    </div>
  );
}
