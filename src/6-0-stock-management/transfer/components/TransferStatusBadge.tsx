import { Badge } from "@/shared/components/ui/badge";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import type { StockTransferStatus } from "../types";

const STATUS_STYLES: Record<StockTransferStatus, string> = {
  pending_approval: "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-50",
  approved: "border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-50",
  shipped: "border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-50",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-50",
  cancelled: "border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-50",
};

export function TransferStatusBadge({ status }: { status: StockTransferStatus }) {
  const { t } = useAppTranslation();
  const labelKey = `operations.inventory.transfer.status.${status === "pending_approval" ? "pendingApproval" : status}`;
  return (
    <Badge variant="outline" className={cn("font-normal", STATUS_STYLES[status])}>
      {t(labelKey, status)}
    </Badge>
  );
}
