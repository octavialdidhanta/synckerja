export type OrderCatalogPublishPlan = "insert" | "delete" | "noop";

export function canPublishToOrderOutlet(args: {
  selectedOutletId: string | null | undefined;
  assignedOutletIds: string[];
}): boolean {
  const outletId = (args.selectedOutletId ?? "").trim();
  if (!outletId) return false;
  return args.assignedOutletIds.some((id) => id === outletId);
}

export function isHiddenForOrderOutlet(args: {
  masterPosStatus: string | null | undefined;
  outletPosStatus: string | null | undefined;
}): boolean {
  const override = (args.outletPosStatus ?? "").trim();
  const master = (args.masterPosStatus ?? "").trim();
  const status = override || master || "available";
  return status === "hidden";
}

export function isOrderCatalogEligible(args: {
  outletId: string;
  assignedOutletIds: string[];
  masterPosStatus: string | null | undefined;
  outletPosStatus: string | null | undefined;
}): boolean {
  if (!args.assignedOutletIds.includes(args.outletId)) return false;
  return !isHiddenForOrderOutlet({
    masterPosStatus: args.masterPosStatus,
    outletPosStatus: args.outletPosStatus,
  });
}

export function planOrderCatalogPublish(args: {
  assigned: boolean;
  wantPublish: boolean;
  currentlyOptedIn: boolean;
}): OrderCatalogPublishPlan {
  const want = Boolean(args.assigned && args.wantPublish);
  if (want && !args.currentlyOptedIn) return "insert";
  if (!want && args.currentlyOptedIn) return "delete";
  return "noop";
}

export function orphanOrderPublishOutletIds(args: {
  optedInOutletIds: string[];
  assignedOutletIds: string[];
}): string[] {
  const assigned = new Set(args.assignedOutletIds.filter(Boolean));
  return args.optedInOutletIds.filter((id) => Boolean(id) && !assigned.has(id));
}
