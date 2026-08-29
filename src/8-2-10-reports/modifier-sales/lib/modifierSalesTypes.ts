export type ModifierSalesMetrics = {
  qtySold: number;
  grossSales: number;
  discountAmount: number;
  refundAmount: number;
  netSales: number;
};

export type ModifierSalesGroupRow = ModifierSalesMetrics & {
  groupId: string | null;
  groupName: string;
  sortOrder: number;
};

export type ModifierSalesOptionRow = ModifierSalesMetrics & {
  groupId: string | null;
  groupName: string;
  groupSortOrder: number;
  optionId: string;
  optionName: string;
  optionSortOrder: number;
};

export type ModifierSalesDisplayRow =
  | ({ rowKind: "group" } & ModifierSalesGroupRow)
  | ({ rowKind: "option" } & ModifierSalesOptionRow);

export type ModifierSalesTotals = ModifierSalesMetrics;

export type ModifierSalesDisplay = {
  groups: ModifierSalesGroupRow[];
  options: ModifierSalesOptionRow[];
  displayRows: ModifierSalesDisplayRow[];
  grandTotal: ModifierSalesTotals;
  summaryModifierNetSales: number;
};

export const EMPTY_MODIFIER_SALES_DISPLAY: ModifierSalesDisplay = {
  groups: [],
  options: [],
  displayRows: [],
  grandTotal: {
    qtySold: 0,
    grossSales: 0,
    discountAmount: 0,
    refundAmount: 0,
    netSales: 0,
  },
  summaryModifierNetSales: 0,
};

export type ModifierSalesSortKey =
  | "groupName"
  | "qtySold"
  | "grossSales"
  | "discountAmount"
  | "refundAmount"
  | "netSales";

export type ModifierSalesSortDir = "asc" | "desc";
