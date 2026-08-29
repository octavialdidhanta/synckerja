import { Badge } from "@/shared/components/ui/badge";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { invoiceStatusLabelKey } from "../../layout/invoiceStatus";
import type { InvoiceDisplayStatus } from "../lib/computeInvoiceDisplayStatus";

const STATUS_CLASS: Record<InvoiceDisplayStatus, string> = {
  unpaid: "bg-amber-100 text-amber-900 hover:bg-amber-100",
  partial: "bg-sky-100 text-sky-900 hover:bg-sky-100",
  paid: "bg-emerald-100 text-emerald-900 hover:bg-emerald-100",
  overdue: "bg-red-100 text-red-900 hover:bg-red-100",
  cancelled: "bg-gray-100 text-gray-700 hover:bg-gray-100",
};

type Props = {
  status: InvoiceDisplayStatus;
  className?: string;
};

export function InvoiceStatusBadge({ status, className }: Props) {
  const { t } = useAppTranslation();
  const labelKey = invoiceStatusLabelKey(status);
  const defaults: Record<InvoiceDisplayStatus, string> = {
    unpaid: "Unpaid",
    partial: "Partially Paid",
    paid: "Paid",
    overdue: "Overdue",
    cancelled: "Cancelled",
  };

  return (
    <Badge variant="secondary" className={cn(STATUS_CLASS[status], className)}>
      {t(labelKey, defaults[status])}
    </Badge>
  );
}
