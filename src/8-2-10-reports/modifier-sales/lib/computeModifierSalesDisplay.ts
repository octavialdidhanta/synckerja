import {
  EMPTY_MODIFIER_SALES_DISPLAY,
  type ModifierSalesDisplay,
  type ModifierSalesDisplayRow,
  type ModifierSalesGroupRow,
  type ModifierSalesOptionRow,
  type ModifierSalesSortDir,
  type ModifierSalesSortKey,
} from "./modifierSalesTypes";

function num(row: Partial<Record<string, unknown>>, key: string): number {
  const v = Number(row[key] ?? 0);
  return Number.isFinite(v) ? v : 0;
}

function normalizeMetrics(row: Partial<Record<string, unknown>>) {
  const grossSales = num(row, "gross_sales");
  const discountAmount = num(row, "discount_amount");
  const refundAmount = num(row, "refund_amount");
  const netSales =
    row.net_sales != null && Number.isFinite(Number(row.net_sales))
      ? num(row, "net_sales")
      : grossSales - discountAmount - refundAmount;

  return {
    qtySold: num(row, "qty_sold"),
    grossSales,
    discountAmount,
    refundAmount,
    netSales,
  };
}

export function normalizeModifierSalesGroupRow(
  row: Partial<Record<string, unknown>> | null | undefined,
  unknownGroupLabel: string,
): ModifierSalesGroupRow {
  if (!row) {
    return {
      groupId: null,
      groupName: unknownGroupLabel,
      sortOrder: 9999,
      qtySold: 0,
      grossSales: 0,
      discountAmount: 0,
      refundAmount: 0,
      netSales: 0,
    };
  }

  const groupId = row.group_id != null ? String(row.group_id) : null;
  const rawName = String(row.group_name ?? "").trim();

  return {
    groupId,
    groupName: rawName || unknownGroupLabel,
    sortOrder: Math.round(num(row, "sort_order")) || 9999,
    ...normalizeMetrics(row),
  };
}

export function normalizeModifierSalesOptionRow(
  row: Partial<Record<string, unknown>> | null | undefined,
  unknownGroupLabel: string,
): ModifierSalesOptionRow {
  if (!row) {
    return {
      groupId: null,
      groupName: unknownGroupLabel,
      groupSortOrder: 9999,
      optionId: "",
      optionName: "Unknown",
      optionSortOrder: 9999,
      qtySold: 0,
      grossSales: 0,
      discountAmount: 0,
      refundAmount: 0,
      netSales: 0,
    };
  }

  const groupId = row.group_id != null ? String(row.group_id) : null;
  const rawGroupName = String(row.group_name ?? "").trim();

  return {
    groupId,
    groupName: rawGroupName || unknownGroupLabel,
    groupSortOrder: Math.round(num(row, "group_sort_order")) || 9999,
    optionId: String(row.option_id ?? ""),
    optionName: String(row.option_name ?? "Unknown").trim() || "Unknown",
    optionSortOrder: Math.round(num(row, "option_sort_order")) || 9999,
    ...normalizeMetrics(row),
  };
}

export function groupRowKey(groupId: string | null): string {
  return groupId ?? "__unknown_group__";
}

function sumGroupTotals(groups: ModifierSalesGroupRow[]) {
  return groups.reduce(
    (acc, row) => ({
      qtySold: acc.qtySold + row.qtySold,
      grossSales: acc.grossSales + row.grossSales,
      discountAmount: acc.discountAmount + row.discountAmount,
      refundAmount: acc.refundAmount + row.refundAmount,
      netSales: acc.netSales + row.netSales,
    }),
    {
      qtySold: 0,
      grossSales: 0,
      discountAmount: 0,
      refundAmount: 0,
      netSales: 0,
    },
  );
}

export function buildModifierSalesDisplay(args: {
  groupRowsRaw: Array<Partial<Record<string, unknown>>> | null | undefined;
  optionRowsRaw: Array<Partial<Record<string, unknown>>> | null | undefined;
  unknownGroupLabel: string;
}): ModifierSalesDisplay {
  if (!args.groupRowsRaw?.length && !args.optionRowsRaw?.length) {
    return EMPTY_MODIFIER_SALES_DISPLAY;
  }

  const groups = (args.groupRowsRaw ?? []).map((r) =>
    normalizeModifierSalesGroupRow(r, args.unknownGroupLabel),
  );
  const options = (args.optionRowsRaw ?? []).map((r) =>
    normalizeModifierSalesOptionRow(r, args.unknownGroupLabel),
  );

  const summaryModifierNetSales = num(
    args.groupRowsRaw?.[0] ?? args.optionRowsRaw?.[0] ?? {},
    "summary_modifier_net_sales",
  );
  const grandTotal = sumGroupTotals(groups);

  const optionsByGroup = new Map<string, ModifierSalesOptionRow[]>();
  for (const option of options) {
    const key = groupRowKey(option.groupId);
    const list = optionsByGroup.get(key) ?? [];
    list.push(option);
    optionsByGroup.set(key, list);
  }

  const displayRows: ModifierSalesDisplayRow[] = [];
  for (const group of groups) {
    displayRows.push({ rowKind: "group", ...group });
    const children = [...(optionsByGroup.get(groupRowKey(group.groupId)) ?? [])].sort(
      (a, b) =>
        b.netSales - a.netSales ||
        a.optionSortOrder - b.optionSortOrder ||
        a.optionName.localeCompare(b.optionName),
    );
    for (const option of children) {
      displayRows.push({ rowKind: "option", ...option });
    }
  }

  return {
    groups,
    options,
    displayRows,
    grandTotal,
    summaryModifierNetSales,
  };
}

export function sortModifierSalesGroups(
  groups: ModifierSalesGroupRow[],
  sortKey: ModifierSalesSortKey,
  sortDir: ModifierSalesSortDir,
): ModifierSalesGroupRow[] {
  const dir = sortDir === "asc" ? 1 : -1;
  return [...groups].sort((a, b) => {
    if (sortKey === "groupName") {
      const cmp = a.groupName.localeCompare(b.groupName, undefined, { sensitivity: "base" });
      if (cmp !== 0) return dir * cmp;
      return a.sortOrder - b.sortOrder;
    }
    const av = a[sortKey];
    const bv = b[sortKey];
    if (av === bv) return a.groupName.localeCompare(b.groupName, undefined, { sensitivity: "base" });
    return dir * (av - bv);
  });
}

export function rebuildModifierDisplayRows(
  groups: ModifierSalesGroupRow[],
  options: ModifierSalesOptionRow[],
): ModifierSalesDisplayRow[] {
  const optionsByGroup = new Map<string, ModifierSalesOptionRow[]>();
  for (const option of options) {
    const key = groupRowKey(option.groupId);
    const list = optionsByGroup.get(key) ?? [];
    list.push(option);
    optionsByGroup.set(key, list);
  }

  const displayRows: ModifierSalesDisplayRow[] = [];
  for (const group of groups) {
    displayRows.push({ rowKind: "group", ...group });
    const children = [...(optionsByGroup.get(groupRowKey(group.groupId)) ?? [])].sort(
      (a, b) =>
        b.netSales - a.netSales ||
        a.optionSortOrder - b.optionSortOrder ||
        a.optionName.localeCompare(b.optionName),
    );
    for (const option of children) {
      displayRows.push({ rowKind: "option", ...option });
    }
  }
  return displayRows;
}

export function sortModifierOptionsForExport(
  options: ModifierSalesOptionRow[],
): ModifierSalesOptionRow[] {
  return [...options].sort(
    (a, b) =>
      a.groupSortOrder - b.groupSortOrder ||
      a.groupName.localeCompare(b.groupName) ||
      b.netSales - a.netSales ||
      a.optionSortOrder - b.optionSortOrder ||
      a.optionName.localeCompare(b.optionName),
  );
}
