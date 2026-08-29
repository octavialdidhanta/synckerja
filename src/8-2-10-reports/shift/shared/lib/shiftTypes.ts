export type ShiftRow = {
  shiftId: string;
  outletId: string;
  outletName: string;
  openedAt: string;
  closedAt: string | null;
  status: "open" | "closed";
  openedByUserId: string | null;
  openedByName: string;
  openingCash: number;
  expectedCash: number;
  closingCash: number | null;
  cashDifference: number | null;
};

export type ShiftListSummary = {
  shiftCount: number;
  openCount: number;
  totalShortage: number;
};

export type ShiftSoldLine = {
  serviceName: string | null;
  subServiceName: string | null;
  quantity: number;
};

export type ShiftCashMovementRow = {
  id: string;
  direction: "in" | "out";
  amount: number;
  description: string;
  createdAt: string;
};

export type ShiftPaymentMethodRow = {
  paymentMethod: string;
  totalCollected: number;
};

export type ShiftDetail = {
  shiftId: string;
  outletId: string;
  outletName: string;
  openedAt: string;
  closedAt: string | null;
  status: "open" | "closed";
  openedByUserId: string | null;
  openedByName: string;
  closedByUserId: string | null;
  closedByName: string;
  openingCash: number;
  expectedCash: number;
  closingCash: number | null;
  cashDifference: number | null;
  cashSales: number;
  cashRefunds: number;
  cashFromInvoices: number;
  cashIn: number;
  cashOut: number;
  cashInOutNet: number;
  productsSoldQty: number;
  refundedProductsQty: number;
  soldLines: ShiftSoldLine[];
  cashMovements: ShiftCashMovementRow[];
  paymentMethods: ShiftPaymentMethodRow[];
};

export type ShiftStaffOption = {
  userId: string;
  label: string;
};
