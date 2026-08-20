import { Badge } from "@/shared/components/ui/badge";
import { cn } from "@/shared/lib/utils";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { PurchaseOrderStatus } from "../types";

export function PurchaseOrderStatusBadge({ status }: { status: PurchaseOrderStatus }) {
  const { t } = useAppTranslation();

  const config: Record<PurchaseOrderStatus, { label: string; className: string }> = {
    waiting: {
      label: t("operations.inventory.purchaseOrders.status.waiting", "Waiting for Fulfillment"),
      className: "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-50",
    },
    completed: {
      label: t("operations.inventory.purchaseOrders.status.completed", "Completed"),
      className: "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-50",
    },
    cancelled: {
      label: t("operations.inventory.purchaseOrders.status.cancelled", "Cancelled"),
      className: "border-red-200 bg-red-50 text-red-800 hover:bg-red-50",
    },
  };

  const item = config[status];
  return (
    <Badge variant="outline" className={cn("font-normal", item.className)}>
      {item.label}
    </Badge>
  );
}
