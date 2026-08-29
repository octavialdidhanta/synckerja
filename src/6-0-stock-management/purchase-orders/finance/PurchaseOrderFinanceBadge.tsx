import { Link } from "react-router-dom";
import { Badge } from "@/shared/components/ui/badge";
import { cn } from "@/shared/lib/utils";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { poFinanceHref, type PoFinanceStatus } from "./poFinanceStatus";

const CONFIG: Record<
  Exclude<PoFinanceStatus, "none">,
  { labelKey: string; fallback: string; className: string }
> = {
  submitted: {
    labelKey: "operations.inventory.purchaseOrders.finance.submitted",
    fallback: "Submitted",
    className: "border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-50",
  },
  approved: {
    labelKey: "operations.inventory.purchaseOrders.finance.approved",
    fallback: "Approved",
    className: "border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-50",
  },
  paid: {
    labelKey: "operations.inventory.purchaseOrders.finance.paid",
    fallback: "Paid",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-50",
  },
  rejected: {
    labelKey: "operations.inventory.purchaseOrders.finance.rejected",
    fallback: "Rejected",
    className: "border-red-200 bg-red-50 text-red-800 hover:bg-red-50",
  },
  cancelled: {
    labelKey: "operations.inventory.purchaseOrders.finance.cancelled",
    fallback: "Cancelled",
    className: "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-50",
  },
};

export function PurchaseOrderFinanceBadge(props: {
  status: PoFinanceStatus;
  className?: string;
}) {
  const { t } = useAppTranslation();
  if (props.status === "none") return null;

  const item = CONFIG[props.status];
  const href = poFinanceHref(props.status);
  const badge = (
    <Badge variant="outline" className={cn("font-normal", item.className, props.className)}>
      {t(item.labelKey, item.fallback)}
    </Badge>
  );

  if (!href) return badge;

  return (
    <Link
      to={href}
      onClick={(event) => event.stopPropagation()}
      className="inline-flex"
      title={t("operations.inventory.purchaseOrders.finance.open", "Open in Expenses")}
    >
      {badge}
    </Link>
  );
}
