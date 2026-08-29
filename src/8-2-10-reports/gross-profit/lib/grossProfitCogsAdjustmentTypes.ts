export type GrossProfitCogsAdjustment = {
  id: string;
  organizationId: string;
  posOutletId: string | null;
  amount: number;
  reason: string | null;
  adjustmentDate: string;
  createdAt: string;
};
