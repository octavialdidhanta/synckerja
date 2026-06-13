import { useTranslation } from "react-i18next";
import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import type { TikTokShopOrderRow } from "@/tiktok-shop/hooks/useTikTokShopOrdersQuery";
import { formatTikTokShopMoney } from "@/tiktok-shop/lib/formatTikTokShopMoney";

type Props = {
  rows: TikTokShopOrderRow[];
  currency: string;
  isLoading?: boolean;
  onOrderSelect?: (orderId: string) => void;
};

function formatOrderTime(createTime: number | null): string {
  if (createTime == null || !Number.isFinite(createTime)) return "—";
  const ms = createTime >= 1_000_000_000_000 ? createTime : createTime * 1000;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(ms));
}

function formatStatus(status: string): string {
  return status.replace(/_/g, " ");
}

export function TikTokShopOrdersTable({
  rows,
  currency,
  isLoading = false,
  onOrderSelect,
}: Props) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex min-h-[200px] items-center justify-center p-6 text-sm text-muted-foreground">
        {t(
          "digitalMarketing.tiktokShop.dashboard.noOrders",
          "No orders in this date range.",
        )}
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              {t("digitalMarketing.tiktokShop.dashboard.colOrderId", "Order ID")}
            </TableHead>
            <TableHead>
              {t("digitalMarketing.tiktokShop.dashboard.colStatus", "Status")}
            </TableHead>
            <TableHead>
              {t("digitalMarketing.tiktokShop.dashboard.colCreated", "Created")}
            </TableHead>
            <TableHead className="text-right">
              {t("digitalMarketing.tiktokShop.dashboard.colUnits", "Units")}
            </TableHead>
            <TableHead className="text-right">
              {t("digitalMarketing.tiktokShop.dashboard.colGmv", "GMV")}
            </TableHead>
            <TableHead className="w-16 text-right">
              {t("digitalMarketing.tiktokShop.dashboard.colView", "View")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.order_id}
              className={onOrderSelect ? "cursor-pointer hover:bg-muted/40" : undefined}
              onClick={onOrderSelect ? () => onOrderSelect(row.order_id) : undefined}
            >
              <TableCell className="font-mono text-xs">{row.order_id}</TableCell>
              <TableCell className="capitalize">{formatStatus(row.status)}</TableCell>
              <TableCell>{formatOrderTime(row.create_time)}</TableCell>
              <TableCell className="text-right">{row.units_sold}</TableCell>
              <TableCell className="text-right">
                {formatTikTokShopMoney(row.gmv, row.currency || currency)}
              </TableCell>
              <TableCell className="text-right">
                {onOrderSelect ? (
                  <button
                    type="button"
                    className="text-xs font-medium text-primary hover:underline"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOrderSelect(row.order_id);
                    }}
                  >
                    {t("digitalMarketing.tiktokShop.dashboard.viewOrder", "View")}
                  </button>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
