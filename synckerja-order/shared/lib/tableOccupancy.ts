export function remainingTablePax(tablePax: number, occupiedPax: number): number {
  const cap = Math.max(0, Math.floor(Number(tablePax) || 0));
  const used = Math.max(0, Math.floor(Number(occupiedPax) || 0));
  return Math.max(0, cap - used);
}

export function canJoinOccupiedTable(remainingPax: number): boolean {
  return remainingPax >= 1;
}

export type TableJoinDecision = "empty" | "join" | "full";

export function decideTableJoin(args: {
  tablePax: number;
  occupiedPax: number;
  hasOpenSession: boolean;
}): TableJoinDecision {
  const remaining = remainingTablePax(args.tablePax, args.occupiedPax);
  if (!args.hasOpenSession) {
    return remaining >= 1 ? "empty" : "full";
  }
  return canJoinOccupiedTable(remaining) ? "join" : "full";
}
