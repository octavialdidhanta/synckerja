import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/features/ui/dialog";
import { Badge } from "@/features/ui/badge";
import { Button } from "@/features/ui/button";
import { Receipt } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/mobile/hooks/use-mobile";
import { formatToRupiah } from "@/utils/formatCurrency";
import type { IncomeTransactionWithRelations } from "@/features/4-1-dashboard/types";
import { useAppTranslation } from "@/features/share/i18n/useAppTranslation";
import { useBankAccounts } from "@/hooks/organized/useBankAccounts";

interface MobileIncomeTransactionDetailsModalProps {
  transaction: IncomeTransactionWithRelations | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: () => void;
}

export function MobileIncomeTransactionDetailsModal({
  transaction,
  open,
  onOpenChange,
  onEdit,
}: MobileIncomeTransactionDetailsModalProps) {
  const { t } = useAppTranslation();
  const isMobile = useIsMobile();
  const { bankAccounts } = useBankAccounts({ includeInactive: true });
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);
  const receiptPath = transaction?.receipt_file_path as string | null | undefined;

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "completed":
        return "default";
      case "pending":
        return "secondary";
      case "cancelled":
        return "destructive";
      default:
        return "outline";
    }
  };

  const handleDownloadReceipt = async () => {
    if (!transaction?.receipt_file_path) return;
    try {
      const path = transaction.receipt_file_path as string;
      if (path.startsWith("http")) {
        window.open(path, "_blank");
        return;
      }
      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error } = await supabase.storage.from("income-receipts").download(path);
      if (error) return;
      const url = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = url;
      link.download = transaction.receipt_file_name || `receipt-${transaction.id.substring(0, 8)}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    let cancelled = false;

    const resolvePreviewUrl = async () => {
      const path = receiptPath ?? null;
      if (!open || !path || /\.pdf$/i.test(path)) {
        setReceiptPreviewUrl(null);
        return;
      }
      if (path.startsWith("http")) {
        setReceiptPreviewUrl(path);
        return;
      }
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data } = await supabase.storage.from("income-receipts").createSignedUrl(path, 60 * 30);
        if (!cancelled) {
          setReceiptPreviewUrl(data?.signedUrl ?? null);
        }
      } catch {
        if (!cancelled) {
          setReceiptPreviewUrl(null);
        }
      }
    };

    void resolvePreviewUrl();
    return () => {
      cancelled = true;
    };
  }, [open, receiptPath]);

  const bankDisplay = useMemo(() => {
    if (!transaction) return null;
    const joined = transaction.bank_accounts;
    if (joined && typeof joined === "object" && !Array.isArray(joined) && joined.name) {
      return {
        primary: joined.name,
        secondary: [joined.bank_name, joined.account_number].filter(Boolean).join(" · "),
      };
    }
    const id = transaction.bank_account_id?.trim();
    if (!id) return null;
    const b = bankAccounts.find((x) => x.id === id);
    if (b) {
      return {
        primary: b.name,
        secondary: [b.bank_name, b.account_number].filter(Boolean).join(" · "),
      };
    }
    return {
      primary: t("incomes.previouslySelectedAccount", "Previously selected account"),
      secondary: "",
    };
  }, [transaction, bankAccounts, t]);

  if (!transaction) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          isMobile
            ? "fixed left-0 right-0 top-0 translate-x-0 translate-y-0 w-full max-w-none max-h-none rounded-none modal-above-safe-area flex flex-col p-0 gap-0 overflow-hidden"
            : "max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden"
        )}
        fullscreenAnimation={isMobile}
      >
        <DialogHeader className="flex-shrink-0 border-b bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 text-left safe-area-top px-4 pt-4 pb-3">
          <DialogTitle className="text-lg font-semibold">Income Transaction Details</DialogTitle>
          <DialogDescription>Detailed information for selected income transaction</DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden seamless-scroll px-4 py-4">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Detail label="Transaction Date" value={format(new Date(transaction.transaction_date), "MMM dd, yyyy")} />
              <Detail label="Amount" value={formatToRupiah(transaction.amount)} valueClassName="font-semibold text-green-600" />
            </div>

            <div>
              <p className="text-sm font-medium text-gray-500">{t("incomes.tableTransactionId", "Transaction ID")}</p>
              <p className="text-sm text-gray-900 mt-1 font-mono break-all">
                {transaction.transaction_reference?.trim() || "—"}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Detail label="Customer Name" value={transaction.customer_name || "-"} />
              <Detail label="Payment Method" value={transaction.payment_method || "-"} />
            </div>

            <div>
              <p className="text-sm font-medium text-gray-500">{t("incomes.bankAccount", "Bank Account")}</p>
              <p className="text-sm text-gray-900 mt-1">{bankDisplay?.primary ?? "-"}</p>
              {bankDisplay?.secondary ? (
                <p className="text-xs text-gray-500 mt-1">{bankDisplay.secondary}</p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Service</p>
                <p className="text-sm text-gray-900 mt-1">{transaction.services?.name || "-"}</p>
                {transaction.sub_services?.name ? (
                  <p className="text-xs text-gray-500 mt-1">{transaction.sub_services.name}</p>
                ) : null}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Type & Category</p>
                <p className="text-sm text-gray-900 mt-1">{transaction.income_types?.name || "Unknown"}</p>
                {transaction.income_categories?.name ? (
                  <p className="text-xs text-gray-500 mt-1">{transaction.income_categories.name}</p>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Status</p>
                <div className="mt-1">
                  <Badge variant={getStatusBadgeVariant(transaction.status || "")} className="text-xs">
                    {transaction.status || "-"}
                  </Badge>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Recurring</p>
                <div className="mt-1">
                  <Badge
                    variant="outline"
                    className={transaction.is_recurring ? "text-xs bg-purple-50 text-purple-700 border-purple-200" : "text-xs"}
                  >
                    {transaction.is_recurring
                      ? transaction.recurring_frequency
                        ? `Recurring - ${transaction.recurring_frequency}`
                        : "Recurring"
                      : "One-time"}
                  </Badge>
                </div>
              </div>
            </div>

            {transaction.description ? (
              <div>
                <p className="text-sm font-medium text-gray-500">Description</p>
                <p className="text-sm text-gray-900 mt-1 whitespace-pre-wrap">{transaction.description}</p>
              </div>
            ) : null}

            {transaction.receipt_file_path ? (
              <div>
                <p className="text-sm font-medium text-gray-500">{t("expenses.receipt", "Receipt")}</p>
                <div className="mt-2 space-y-2">
                  <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={handleDownloadReceipt}>
                    <Receipt className="h-3 w-3 mr-1" />
                    {t("expenses.viewReceipt", "View Receipt")}
                  </Button>
                  {!/\.pdf$/i.test(transaction.receipt_file_path) && receiptPreviewUrl ? (
                    <div className="w-full min-h-[calc(100vh-12rem)] rounded-md border bg-muted/30 overflow-hidden">
                      <img
                        src={receiptPreviewUrl}
                        alt={t("expenses.receipt", "Receipt")}
                        className="w-full min-h-[calc(100vh-12rem)] object-contain object-left-top"
                      />
                    </div>
                  ) : /\.pdf$/i.test(transaction.receipt_file_path) ? (
                    <p className="text-xs text-muted-foreground">
                      {t("expenses.receiptPdf", "PDF receipt — use button above to open")}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="px-4 pt-3 pb-3 flex-shrink-0 border-t bg-muted/30">
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            {onEdit ? (
              <Button
                type="button"
                size="sm"
                className="min-w-[120px] flex items-center justify-center gap-1.5"
                onClick={() => {
                  onEdit();
                  onOpenChange(false);
                }}
              >
                Edit Transaction
              </Button>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Detail({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className={cn("text-sm text-gray-900 mt-1", valueClassName)}>{value}</p>
    </div>
  );
}
