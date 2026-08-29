/**
 * Pure leave-gate rules for logout / switch-outlet when a shift is open.
 * Used by PosSessionLeaveProvider and unit tests.
 */

export function shouldGateLeaveForOpenShift<T extends { id: string }>(
  openShift: T | null | undefined,
): openShift is T {
  return openShift != null;
}

export function canUserEndOpenShift(args: {
  openedBy: string | null;
  userId: string | null | undefined;
  unrestricted: boolean;
}): boolean {
  if (args.unrestricted) return true;
  if (!args.userId || !args.openedBy) return false;
  return args.openedBy === args.userId;
}
