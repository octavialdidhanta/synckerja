import { describe, expect, it } from "vitest";
import { buildPosActivityItemSummary } from "./buildPosActivityItemSummary";
import {
  formatPosActivityReceiptNumber,
  normalizePosActivitySearchNeedle,
} from "./formatPosActivityReceiptNumber";
import { filterPosActivityRows } from "./filterPosActivityRows";
import { groupPosActivitiesByDate } from "./groupPosActivitiesByDate";
import type { PosActivityListRow } from "./posActivityTypes";

function row(
  partial: Partial<PosActivityListRow> & Pick<PosActivityListRow, "id" | "created_at">,
): PosActivityListRow {
  return {
    date: null,
    total_amount: 0,
    total_paid_amount: 1000,
    payment_method: "cash",
    client_name: null,
    client_phone: null,
    lead_id: null,
    checkout_subtotal: null,
    checkout_tax_amount: null,
    checkout_gratuity_amount: null,
    cash_tendered: null,
    payment_reference: null,
    itemSummary: "",
    ...partial,
  };
}

describe("buildPosActivityItemSummary", () => {
  it("joins up to three product names", () => {
    expect(
      buildPosActivityItemSummary([
        { service_name: "Aqua", sub_service_name: null },
        { service_name: "Cake", sub_service_name: "Large" },
        { service_name: "Tea", sub_service_name: null },
      ]),
    ).toBe("Aqua, Cake, Tea");
  });

  it("truncates beyond maxNames", () => {
    expect(
      buildPosActivityItemSummary(
        [
          { service_name: "A", sub_service_name: null },
          { service_name: "B", sub_service_name: null },
          { service_name: "C", sub_service_name: null },
          { service_name: "D", sub_service_name: null },
        ],
        3,
      ),
    ).toBe("A, B, C…");
  });
});

describe("groupPosActivitiesByDate", () => {
  it("groups today and yesterday", () => {
    const now = new Date("2024-04-10T15:00:00");
    const groups = groupPosActivitiesByDate(
      [
        row({ id: "1", created_at: "2024-04-10T10:00:00", date: "2024-04-10" }),
        row({ id: "2", created_at: "2024-04-09T10:00:00", date: "2024-04-09" }),
        row({ id: "3", created_at: "2024-04-06T10:00:00", date: "2024-04-06" }),
      ],
      now,
    );
    expect(groups.map((g) => g.labelKind)).toEqual(["today", "yesterday", "date"]);
    expect(groups[0].rows).toHaveLength(1);
  });
});

describe("formatPosActivityReceiptNumber", () => {
  it("formats SC receipt code", () => {
    expect(
      formatPosActivityReceiptNumber("a57c62c6-2a1a-4cfe-8d50-eeb68b76450e"),
    ).toBe("SC-A57C62C6");
  });
});

describe("filterPosActivityRows", () => {
  it("matches receipt code and client name", () => {
    const rows = [
      row({
        id: "a57c62c6-2a1a-4cfe-8d50-eeb68b76450e",
        created_at: "2024-04-10T10:00:00",
        client_name: "Arizal",
      }),
    ];
    expect(filterPosActivityRows(rows, "SC-A57C62C6")).toHaveLength(1);
    expect(filterPosActivityRows(rows, "ariz")).toHaveLength(1);
    expect(filterPosActivityRows(rows, "zzz")).toHaveLength(0);
  });

  it("normalizes search needle", () => {
    expect(normalizePosActivitySearchNeedle("SC-A57C")).toBe("a57c");
  });
});
