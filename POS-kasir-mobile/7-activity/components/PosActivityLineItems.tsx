import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import type { PosActivityApplicationMethod } from "../lib/computePosActivityDisplayTotals";
import type { PosActivityDetail } from "../lib/posActivityTypes";
import { PosActivityProductSection } from "./PosActivityProductSection";

type Props = {
  detail: PosActivityDetail;
  cartSnapshot?: CustomerVisitCartLine[] | null;
  salesTypeNameById: Map<string, string>;
  applicationMethod: PosActivityApplicationMethod;
  taxLabel: string;
  gratuityLabel: string;
};

/** @deprecated Prefer PosActivityProductSection — kept for stable imports. */
export function PosActivityLineItems(props: Props) {
  return <PosActivityProductSection {...props} />;
}
