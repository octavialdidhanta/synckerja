/** Breakdown bar chart entries: highest amount first (leftmost). */
export function sortedBreakdownEntries(
  totals: Record<string, number>,
): Array<[label: string, amount: number]> {
  return Object.entries(totals).sort(([, a], [, b]) => b - a);
}

export function aggregateExpenseTotalsByKey<T>(
  items: T[],
  getKey: (item: T) => string,
  getAmount: (item: T) => number,
): Record<string, number> {
  return items.reduce(
    (acc, item) => {
      const key = getKey(item) || "Uncategorized";
      acc[key] = (acc[key] || 0) + getAmount(item);
      return acc;
    },
    {} as Record<string, number>,
  );
}
