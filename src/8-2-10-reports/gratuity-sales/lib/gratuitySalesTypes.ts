export type GratuitySalesMetrics = {
  gratuityCollected: number;
  /** Internal — reconciliation / footnotes only */
  timesApplied: number;
  refundAmount: number;
  netGratuity: number;
};

export type GratuitySalesGratuityRow = GratuitySalesMetrics & {
  catalogGratuityId: string | null;
  gratuityName: string;
  sortOrder: number;
  hasBackfillEstimate: boolean;
};

export type GratuitySalesRateRow = GratuitySalesMetrics & {
  catalogGratuityId: string | null;
  gratuityName: string;
  gratuitySortOrder: number;
  rateLabel: string;
  rateSortOrder: number;
  hasBackfillEstimate: boolean;
};

export type GratuitySalesDisplayRow =
  | ({ rowKind: "gratuity" } & GratuitySalesGratuityRow)
  | ({ rowKind: "rate" } & GratuitySalesRateRow);

export type GratuitySalesTotals = Pick<GratuitySalesMetrics, "gratuityCollected" | "netGratuity">;

export type GratuitySalesDisplay = {
  gratuities: GratuitySalesGratuityRow[];
  rates: GratuitySalesRateRow[];
  displayRows: GratuitySalesDisplayRow[];
  grandTotal: GratuitySalesTotals;
  summaryTotalNetGratuity: number;
  hasBackfillEstimate: boolean;
};

export const EMPTY_GRATUITY_SALES_DISPLAY: GratuitySalesDisplay = {
  gratuities: [],
  rates: [],
  displayRows: [],
  grandTotal: {
    gratuityCollected: 0,
    netGratuity: 0,
  },
  summaryTotalNetGratuity: 0,
  hasBackfillEstimate: false,
};

export type GratuitySalesSortKey = "gratuityName" | "gratuityCollected";

export type GratuitySalesSortDir = "asc" | "desc";
