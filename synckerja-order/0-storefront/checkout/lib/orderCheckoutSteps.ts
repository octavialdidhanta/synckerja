import type { OrderCheckoutStep } from "./orderCheckoutCopy";

export type OrderPaymentKind = "online" | "cashier";

export function nextCheckoutStep(step: OrderCheckoutStep | null): OrderCheckoutStep | null {
  if (step === "review") return "payment";
  return null;
}

export function prevCheckoutStep(step: OrderCheckoutStep | null): OrderCheckoutStep | null {
  if (step === "payment") return "review";
  return null;
}

export function canContinueCustomer(name: string): boolean {
  return name.trim().length > 0;
}

export function canSubmitPayment(args: {
  kind: OrderPaymentKind;
  qrisSelected: boolean;
}): boolean {
  if (args.kind === "cashier") return true;
  return args.qrisSelected;
}
