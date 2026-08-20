export function calcWeightedAvgCost(oldQty: number, oldAvg: number, addQty: number, unitCost: number): number {
  const prevQty = Number.isFinite(oldQty) && oldQty > 0 ? oldQty : 0;
  const prevAvg = Number.isFinite(oldAvg) && oldAvg >= 0 ? oldAvg : 0;
  const qty = Number.isFinite(addQty) && addQty > 0 ? addQty : 0;
  const cost = Number.isFinite(unitCost) && unitCost >= 0 ? unitCost : 0;
  if (qty <= 0) return prevAvg;
  if (prevQty + qty <= 0) return cost;
  return Math.round(((prevQty * prevAvg + qty * cost) / (prevQty + qty)) * 100) / 100;
}
