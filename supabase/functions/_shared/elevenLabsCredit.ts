/** Official ElevenLabs `character-cost` response header. Null when the API did not return an exact non-negative integer. */
export function exactCreditCostFromHeader(raw: string | null | undefined): number | null {
  const text = raw?.trim() ?? "";
  if (!/^\d+$/.test(text)) return null;
  const value = Number(text);
  return Number.isSafeInteger(value) ? value : null;
}

/** Sum of recorded costs. Null when nothing was recorded, so an empty audit is not shown as zero. */
export function recordedCreditTotal(costs: Array<number | null | undefined>): number | null {
  const recorded = costs.filter((cost): cost is number => typeof cost === "number" && Number.isSafeInteger(cost) && cost >= 0);
  if (recorded.length === 0) return null;
  return recorded.reduce((sum, cost) => sum + cost, 0);
}
