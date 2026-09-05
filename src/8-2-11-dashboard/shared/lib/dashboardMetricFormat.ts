export function averageSalePerTransaction(
  netSales: number,
  transactionCount: number,
): number {
  if (transactionCount <= 0) return 0;
  return netSales / transactionCount;
}
