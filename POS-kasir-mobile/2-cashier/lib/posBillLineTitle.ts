import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";

/** Product / bundle / custom name only — modifiers stay on detail rows. */
export function posBillLineTitle(
  line: Pick<CustomerVisitCartLine, "serviceName">,
): string {
  return line.serviceName.trim() || "—";
}
