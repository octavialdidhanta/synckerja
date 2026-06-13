import type { TikTokShopOrderRow } from "@/tiktok-shop/hooks/useTikTokShopOrdersQuery";

function escapeCsvCell(value: string | number | null | undefined): string {
  const raw = value == null ? "" : String(value);
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

function formatOrderTimeForCsv(createTime: number | null): string {
  if (createTime == null || !Number.isFinite(createTime)) return "";
  const ms = createTime >= 1_000_000_000_000 ? createTime : createTime * 1000;
  return new Date(ms).toISOString();
}

export function exportTikTokShopOrdersCsv(args: {
  rows: TikTokShopOrderRow[];
  shopName?: string | null;
  dateStart: string;
  dateEnd: string;
  filename?: string;
}): void {
  const { rows, shopName, dateStart, dateEnd, filename } = args;
  const header = [
    "order_id",
    "status",
    "created_at",
    "units_sold",
    "gmv",
    "currency",
  ];
  const lines = [
    header.join(","),
    ...rows.map((row) =>
      [
        escapeCsvCell(row.order_id),
        escapeCsvCell(row.status),
        escapeCsvCell(formatOrderTimeForCsv(row.create_time)),
        escapeCsvCell(row.units_sold),
        escapeCsvCell(row.gmv),
        escapeCsvCell(row.currency),
      ].join(","),
    ),
  ];
  const meta = `# shop: ${shopName ?? ""}; date_start: ${dateStart}; date_end: ${dateEnd}`;
  const csv = `${meta}\n${lines.join("\n")}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download =
    filename ??
    `tiktok-shop-orders-${dateStart}-${dateEnd}.csv`.replace(/[^\w.-]+/g, "_");
  link.click();
  URL.revokeObjectURL(url);
}
