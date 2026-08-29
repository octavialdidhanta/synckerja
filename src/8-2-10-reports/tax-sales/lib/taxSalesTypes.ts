export type TaxSalesMetrics = {
  taxableAmount: number;
  taxCollected: number;
  /** Internal — reconciliation / footnotes only */
  timesApplied: number;
  refundAmount: number;
  netTax: number;
  netTaxableAmount: number;
};

export type TaxSalesTaxRow = TaxSalesMetrics & {
  catalogTaxId: string | null;
  taxName: string;
  sortOrder: number;
  hasBackfillEstimate: boolean;
};

export type TaxSalesRateRow = TaxSalesMetrics & {
  catalogTaxId: string | null;
  taxName: string;
  taxSortOrder: number;
  rateLabel: string;
  rateSortOrder: number;
  hasBackfillEstimate: boolean;
};

export type TaxSalesDisplayRow =
  | ({ rowKind: "tax" } & TaxSalesTaxRow)
  | ({ rowKind: "rate" } & TaxSalesRateRow);

export type TaxSalesTotals = Pick<TaxSalesMetrics, "taxableAmount" | "taxCollected" | "netTax">;

export type TaxSalesDisplay = {
  taxes: TaxSalesTaxRow[];
  rates: TaxSalesRateRow[];
  displayRows: TaxSalesDisplayRow[];
  grandTotal: TaxSalesTotals;
  summaryTotalNetTax: number;
  hasBackfillEstimate: boolean;
};

export const EMPTY_TAX_SALES_DISPLAY: TaxSalesDisplay = {
  taxes: [],
  rates: [],
  displayRows: [],
  grandTotal: {
    taxableAmount: 0,
    taxCollected: 0,
    netTax: 0,
  },
  summaryTotalNetTax: 0,
  hasBackfillEstimate: false,
};

export type TaxSalesSortKey = "taxName" | "taxableAmount" | "taxCollected";

export type TaxSalesSortDir = "asc" | "desc";
