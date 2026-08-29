import { describe, expect, it } from "vitest";
import {
  buildModifierSalesDisplay,
  groupRowKey,
  rebuildModifierDisplayRows,
  sortModifierSalesGroups,
} from "./computeModifierSalesDisplay";

describe("buildModifierSalesDisplay", () => {
  it("returns empty display when no rows", () => {
    const display = buildModifierSalesDisplay({
      groupRowsRaw: [],
      optionRowsRaw: [],
      unknownGroupLabel: "Unknown",
    });
    expect(display.groups).toHaveLength(0);
    expect(display.grandTotal.netSales).toBe(0);
  });

  it("builds hierarchical display rows", () => {
    const display = buildModifierSalesDisplay({
      groupRowsRaw: [
        {
          group_id: "g1",
          group_name: "Add on",
          sort_order: 1,
          qty_sold: 3,
          gross_sales: 7500,
          discount_amount: 0,
          refund_amount: 0,
          net_sales: 7500,
          summary_modifier_net_sales: 7500,
        },
      ],
      optionRowsRaw: [
        {
          group_id: "g1",
          group_name: "Add on",
          group_sort_order: 1,
          option_id: "o1",
          option_name: "Bubble",
          option_sort_order: 1,
          qty_sold: 3,
          gross_sales: 7500,
          discount_amount: 0,
          refund_amount: 0,
          net_sales: 7500,
        },
      ],
      unknownGroupLabel: "Unknown",
    });

    expect(display.displayRows).toHaveLength(2);
    expect(display.displayRows[0].rowKind).toBe("group");
    expect(display.displayRows[1].rowKind).toBe("option");
    expect(display.grandTotal.qtySold).toBe(3);
  });

  it("computes net sales from components when net_sales missing", () => {
    const row = buildModifierSalesDisplay({
      groupRowsRaw: [
        {
          group_id: "g1",
          group_name: "Size",
          gross_sales: 1000,
          discount_amount: 100,
          refund_amount: 50,
        },
      ],
      optionRowsRaw: [],
      unknownGroupLabel: "Unknown",
    }).groups[0];

    expect(row.netSales).toBe(850);
  });
});

describe("groupRowKey", () => {
  it("uses sentinel for null group id", () => {
    expect(groupRowKey(null)).toBe("__unknown_group__");
  });
});

describe("sortModifierSalesGroups", () => {
  const groups = [
    {
      groupId: "a",
      groupName: "B Group",
      sortOrder: 2,
      qtySold: 1,
      grossSales: 100,
      discountAmount: 0,
      refundAmount: 0,
      netSales: 100,
    },
    {
      groupId: "b",
      groupName: "A Group",
      sortOrder: 1,
      qtySold: 2,
      grossSales: 200,
      discountAmount: 0,
      refundAmount: 0,
      netSales: 200,
    },
  ];

  it("sorts by gross sales desc by default key", () => {
    const sorted = sortModifierSalesGroups(groups, "grossSales", "desc");
    expect(sorted[0].groupName).toBe("A Group");
  });

  it("sorts by name asc", () => {
    const sorted = sortModifierSalesGroups(groups, "groupName", "asc");
    expect(sorted[0].groupName).toBe("A Group");
  });
});

describe("rebuildModifierDisplayRows", () => {
  it("keeps options under sorted groups", () => {
    const groups = [
      {
        groupId: "g1",
        groupName: "Add on",
        sortOrder: 1,
        qtySold: 1,
        grossSales: 100,
        discountAmount: 0,
        refundAmount: 0,
        netSales: 100,
      },
    ];
    const options = [
      {
        groupId: "g1",
        groupName: "Add on",
        groupSortOrder: 1,
        optionId: "o1",
        optionName: "Bubble",
        optionSortOrder: 1,
        qtySold: 1,
        grossSales: 100,
        discountAmount: 0,
        refundAmount: 0,
        netSales: 100,
      },
    ];
    const rows = rebuildModifierDisplayRows(groups, options);
    expect(rows).toHaveLength(2);
    expect(rows[1].rowKind).toBe("option");
  });
});
