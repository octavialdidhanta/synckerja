import { describe, expect, it } from "vitest";
import {
  aggregateEfficiencyActualFromAccounts,
  aggregateEfficiencyTargetValues,
  aggregateTargetValues,
} from "@/6-0-digital-marketing-shared/dmReportTargetMetricAggregate";
import type { DmAccountPeriodActuals } from "@/6-0-digital-marketing-shared/dmReportTargetTypes";

function makeActuals(metrics: Record<string, number | null>): DmAccountPeriodActuals {
  return {
    channel: "google",
    accountId: "1",
    hasConnectedAccount: true,
    currencyCode: "IDR",
    metrics,
  };
}

describe("dmReportTargetMetricAggregate", () => {
  it("blends CPC as total cost / total clicks for targeted accounts only", () => {
    const map = new Map<string, DmAccountPeriodActuals>([
      ["google:a", makeActuals({ cost: 23_619, clicks: 4, cpc: 5_905 })],
      ["meta:b", makeActuals({ cost: 149_236, clicks: 164, cpc: 910 })],
      ["google:c", makeActuals({ cost: 0, clicks: 0, cpc: null })],
    ]);

    const all = aggregateEfficiencyActualFromAccounts("cpc", map, null);
    expect(all).toBeCloseTo(172_855 / 168, 0);

    const targetedOnly = aggregateEfficiencyActualFromAccounts(
      "cpc",
      map,
      null,
      new Set(["google:a", "meta:b"]),
    );
    expect(targetedOnly).toBeCloseTo(172_855 / 168, 0);

    const googleOnly = aggregateEfficiencyActualFromAccounts(
      "cpc",
      map,
      null,
      new Set(["google:a"]),
    );
    expect(googleOnly).toBeCloseTo(5_905, 0);
  });

  it("averages CPC targets per channel then across channels", () => {
    expect(
      aggregateEfficiencyTargetValues([
        { channel: "google", accountKey: "google:a", value: 5_000 },
        { channel: "google", accountKey: "google:b", value: 3_000 },
        { channel: "meta", accountKey: "meta:c", value: 1_000 },
      ]),
    ).toBe(2_500);

    expect(
      aggregateEfficiencyTargetValues([
        { channel: "google", accountKey: "google:a", value: 5_000 },
        { channel: "meta", accountKey: "meta:c", value: 1_000 },
      ]),
    ).toBe(3_000);

    expect(
      aggregateTargetValues("cpc", [
        { channel: "google", accountKey: "google:a", value: 5_000 },
        { channel: "meta", accountKey: "meta:b", value: 1_000 },
      ]),
    ).toBe(3_000);
  });

  it("ignores empty targets when averaging", () => {
    expect(
      aggregateEfficiencyTargetValues([
        { channel: "google", accountKey: "google:a", value: 5_000 },
        { channel: "meta", accountKey: "meta:b", value: 1_000 },
      ]),
    ).toBe(3_000);
  });

  it("sums cost targets", () => {
    expect(
      aggregateTargetValues("cost", [
        { channel: "google", accountKey: "google:a", value: 25_000 },
        { channel: "meta", accountKey: "meta:b", value: 150_000 },
      ]),
    ).toBe(175_000);
  });
});
