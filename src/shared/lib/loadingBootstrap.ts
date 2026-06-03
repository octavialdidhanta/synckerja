/**
 * True only while there is no resolved data yet — not during background refetch.
 * Use instead of raw `isLoading` when reporting section/page skeleton state.
 */
export function isBootstrapPending(
  pending: boolean,
  hasResolvedData: boolean,
): boolean {
  return pending && !hasResolvedData;
}
