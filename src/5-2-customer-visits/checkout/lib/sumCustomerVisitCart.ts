import type { CustomerVisitCartLine, CustomerVisitCartTotals } from './customerVisitCheckout.types';

export function lineTotal(line: Pick<CustomerVisitCartLine, 'quantity' | 'unitPrice'>): number {
  const qty = Number(line.quantity);
  const price = Number(line.unitPrice);
  if (!Number.isFinite(qty) || !Number.isFinite(price) || qty <= 0 || price <= 0) return 0;
  return qty * price;
}

export function sumCustomerVisitCart(lines: CustomerVisitCartLine[]): CustomerVisitCartTotals {
  let itemCount = 0;
  let total = 0;
  for (const line of lines) {
    const qty = Number(line.quantity);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    itemCount += qty;
    total += lineTotal(line);
  }
  return {
    lineCount: lines.filter((line) => Number(line.quantity) > 0 && Number(line.unitPrice) > 0).length,
    itemCount,
    total,
  };
}

export function averageOrderValue(revenues: number[]): number {
  const paid = revenues.filter((value) => Number.isFinite(value) && value > 0);
  if (paid.length === 0) return 0;
  const sum = paid.reduce((acc, value) => acc + value, 0);
  return Math.round(sum / paid.length);
}
