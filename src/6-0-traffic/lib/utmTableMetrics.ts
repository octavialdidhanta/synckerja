export type UtmTableMetricsSlice = {
  utmFiltersActive: boolean;
  /** Session count equals the number of UTM rows that pass column filters. */
  filteredSessionsSum: number;
  filteredPageViewsSum: number;
  filteredClicksSum: number;
};

export const EMPTY_UTM_TABLE_METRICS: UtmTableMetricsSlice = {
  utmFiltersActive: false,
  filteredSessionsSum: 0,
  filteredPageViewsSum: 0,
  filteredClicksSum: 0,
};
