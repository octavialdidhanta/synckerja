import { describe, expect, it } from "vitest";
import {
  buildPaymentMethodsDisplay,
  mergePaymentMethodsReport,
  normalizePaymentMethodReportRows,
} from "./computePaymentMethodsDisplay";
import type { PaymentMethodChannelConfig } from "./paymentMethodsTypes";

const CONFIG: PaymentMethodChannelConfig[] = [
  {
    id: "c1",
    organizationId: "org",
    posOutletId: null,
    category: "cash",
    name: "Cash",
    slug: "cash",
    legacyPaymentMethod: "cash",
    isActive: true,
    sortOrder: 10,
  },
  {
    id: "e1",
    organizationId: "org",
    posOutletId: null,
    category: "e_wallet",
    name: "GOPAY",
    slug: "gopay",
    legacyPaymentMethod: "e_wallet",
    isActive: true,
    sortOrder: 20,
  },
  {
    id: "d1",
    organizationId: "org",
    posOutletId: null,
    category: "edc",
    name: "BCA",
    slug: "bca",
    legacyPaymentMethod: "bank_transfer",
    isActive: true,
    sortOrder: 30,
  },
];

describe("normalizePaymentMethodReportRows", () => {
  it("maps RPC rows and summary totals from first row", () => {
    const parsed = normalizePaymentMethodReportRows([
      {
        category: "cash",
        channel_id: "c1",
        channel_name: "Cash",
        channel_slug: "cash",
        transaction_count: 5,
        total_collected: 100000,
        summary_total_collected: 150000,
        summary_transaction_count: 7,
      },
    ]);
    expect(parsed.channels[0].transactionCount).toBe(5);
    expect(parsed.summaryTotalCollected).toBe(150000);
    expect(parsed.summaryTransactionCount).toBe(7);
  });
});

describe("buildPaymentMethodsDisplay", () => {
  it("includes zero rows for active channels without sales", () => {
    const display = buildPaymentMethodsDisplay({
      configChannels: CONFIG,
      reportChannels: [
        {
          channelId: "c1",
          channelName: "Cash",
          channelSlug: "cash",
          category: "cash",
          transactionCount: 3,
          totalCollected: 50000,
        },
      ],
      summaryTotalCollected: 50000,
      summaryTransactionCount: 3,
    });
    expect(display.categories.find((c) => c.category === "cash")?.transactionCount).toBe(3);
    const ewallet = display.categories.find((c) => c.category === "e_wallet");
    expect(ewallet?.channels.some((ch) => ch.channelName === "GOPAY")).toBe(true);
    expect(ewallet?.channels[0].transactionCount).toBe(0);
    expect(display.matchesSummary).toBe(true);
  });

  it("flags mismatch when grand total differs from summary", () => {
    const display = mergePaymentMethodsReport(CONFIG, [
      {
        category: "cash",
        channel_id: "c1",
        channel_name: "Cash",
        channel_slug: "cash",
        transaction_count: 1,
        total_collected: 100,
        summary_total_collected: 200,
        summary_transaction_count: 2,
      },
    ]);
    expect(display.matchesSummary).toBe(false);
  });
});
