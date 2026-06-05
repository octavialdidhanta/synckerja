/** Shared TanStack query keys for `/digital-marketing/report`. */
export function googleAdsAccountsReportQueryKey(organizationId: string | undefined) {
  return ["google-ads-accounts-picker-report", organizationId] as const;
}
