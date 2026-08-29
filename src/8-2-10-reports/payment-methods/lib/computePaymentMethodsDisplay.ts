import {
  EMPTY_PAYMENT_METHODS_DISPLAY,
  PAYMENT_METHOD_CATEGORY_ORDER,
  type PaymentMethodCategory,
  type PaymentMethodChannelConfig,
  type PaymentMethodChannelRow,
  type PaymentMethodsCategoryBlock,
  type PaymentMethodsDisplay,
} from "./paymentMethodsTypes";

const EPSILON = 0.01;

export function parsePaymentMethodCategory(value: unknown): PaymentMethodCategory {
  const raw = String(value ?? "other");
  if (
    raw === "cash" ||
    raw === "qris" ||
    raw === "e_wallet" ||
    raw === "edc" ||
    raw === "e_commerce" ||
    raw === "integration"
  ) {
    return raw;
  }
  return "other";
}

export function normalizePaymentMethodChannel(
  row: Partial<Record<string, unknown>>,
): PaymentMethodChannelConfig {
  return {
    id: String(row.id ?? ""),
    organizationId: String(row.organization_id ?? ""),
    posOutletId: row.pos_outlet_id != null ? String(row.pos_outlet_id) : null,
    category: parsePaymentMethodCategory(row.category),
    name: String(row.name ?? ""),
    slug: String(row.slug ?? ""),
    legacyPaymentMethod:
      row.legacy_payment_method != null ? String(row.legacy_payment_method) : null,
    isActive: row.is_active !== false,
    sortOrder: Number(row.sort_order ?? 0),
  };
}

export function normalizePaymentMethodReportRows(
  rows: Array<Partial<Record<string, unknown>>>,
): {
  channels: PaymentMethodChannelRow[];
  summaryTotalCollected: number;
  summaryTransactionCount: number;
} {
  if (rows.length === 0) {
    return { channels: [], summaryTotalCollected: 0, summaryTransactionCount: 0 };
  }
  const first = rows[0];
  const summaryTotalCollected = Number(first.summary_total_collected ?? 0);
  const summaryTransactionCount = Math.max(
    0,
    Math.round(Number(first.summary_transaction_count ?? 0)),
  );
  const channels = rows.map((row) => ({
    channelId: row.channel_id != null ? String(row.channel_id) : null,
    channelName: String(row.channel_name ?? "Other"),
    channelSlug: String(row.channel_slug ?? "other"),
    category: parsePaymentMethodCategory(row.category),
    transactionCount: Math.max(0, Math.round(Number(row.transaction_count ?? 0))),
    totalCollected: Number(row.total_collected ?? 0),
  }));
  return { channels, summaryTotalCollected, summaryTransactionCount };
}

function channelKey(row: Pick<PaymentMethodChannelRow, "channelId" | "channelSlug">): string {
  return row.channelId ?? `slug:${row.channelSlug}`;
}

export function buildPaymentMethodsDisplay(args: {
  configChannels: PaymentMethodChannelConfig[];
  reportChannels: PaymentMethodChannelRow[];
  summaryTotalCollected: number;
  summaryTransactionCount: number;
}): PaymentMethodsDisplay {
  const reportByKey = new Map<string, PaymentMethodChannelRow>();
  for (const row of args.reportChannels) {
    reportByKey.set(channelKey(row), row);
  }

  const activeConfigs = args.configChannels.filter((c) => c.isActive);
  const categories: PaymentMethodsCategoryBlock[] = [];

  for (const category of PAYMENT_METHOD_CATEGORY_ORDER) {
    const configsInCategory = activeConfigs
      .filter((c) => c.category === category)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

    const channelRows: PaymentMethodChannelRow[] = [];
    const seen = new Set<string>();

    for (const config of configsInCategory) {
      const key = config.id ? config.id : `slug:${config.slug}`;
      seen.add(key);
      const fromReport = reportByKey.get(key);
      channelRows.push(
        fromReport ?? {
          channelId: config.id,
          channelName: config.name,
          channelSlug: config.slug,
          category,
          transactionCount: 0,
          totalCollected: 0,
        },
      );
    }

    for (const row of args.reportChannels.filter((r) => r.category === category)) {
      const key = channelKey(row);
      if (seen.has(key)) continue;
      seen.add(key);
      channelRows.push(row);
    }

    const transactionCount = channelRows.reduce((s, r) => s + r.transactionCount, 0);
    const totalCollected = channelRows.reduce((s, r) => s + r.totalCollected, 0);
    const hasActiveChannels = configsInCategory.length > 0;

    if (!hasActiveChannels && transactionCount === 0 && totalCollected <= EPSILON) {
      continue;
    }

    categories.push({
      category,
      channels: channelRows.sort(
        (a, b) => b.totalCollected - a.totalCollected || a.channelName.localeCompare(b.channelName),
      ),
      transactionCount,
      totalCollected,
      hasActiveChannels,
    });
  }

  const grandTotal = categories.reduce(
    (acc, cat) => ({
      transactionCount: acc.transactionCount + cat.transactionCount,
      totalCollected: acc.totalCollected + cat.totalCollected,
    }),
    { transactionCount: 0, totalCollected: 0 },
  );

  const matchesSummary =
    Math.abs(grandTotal.totalCollected - args.summaryTotalCollected) <= EPSILON &&
    grandTotal.transactionCount === args.summaryTransactionCount;

  return {
    categories,
    grandTotal,
    summaryTotalCollected: args.summaryTotalCollected,
    summaryTransactionCount: args.summaryTransactionCount,
    matchesSummary,
  };
}

export function mergePaymentMethodsReport(
  configChannels: PaymentMethodChannelConfig[],
  reportRows: Array<Partial<Record<string, unknown>>>,
): PaymentMethodsDisplay {
  const { channels, summaryTotalCollected, summaryTransactionCount } =
    normalizePaymentMethodReportRows(reportRows);
  if (configChannels.length === 0 && channels.length === 0) {
    return {
      ...EMPTY_PAYMENT_METHODS_DISPLAY,
      summaryTotalCollected,
      summaryTransactionCount,
    };
  }
  return buildPaymentMethodsDisplay({
    configChannels,
    reportChannels: channels,
    summaryTotalCollected,
    summaryTransactionCount,
  });
}
