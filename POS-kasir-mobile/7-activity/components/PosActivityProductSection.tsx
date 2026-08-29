import { useMemo } from "react";
import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { PosActivityApplicationMethod } from "../lib/computePosActivityDisplayTotals";
import { groupPosActivityProductsBySalesType } from "../lib/groupPosActivityProductsBySalesType";
import { POS_ACTIVITY_I18N } from "../lib/posActivityCopy";
import type { PosActivityDetail } from "../lib/posActivityTypes";
import { PosActivityProductGroupBlock } from "./PosActivityProductGroup";
import { PosActivityTotalsBlock } from "./PosActivityTotalsBlock";

type Props = {
  detail: PosActivityDetail;
  cartSnapshot?: CustomerVisitCartLine[] | null;
  salesTypeNameById: Map<string, string>;
  applicationMethod: PosActivityApplicationMethod;
  taxLabel: string;
  gratuityLabel: string;
};

export function PosActivityProductSection({
  detail,
  cartSnapshot,
  salesTypeNameById,
  applicationMethod,
  taxLabel,
  gratuityLabel,
}: Props) {
  const { t } = useAppTranslation();
  const unknownLabel = t(POS_ACTIVITY_I18N.salesTypeUnknown, "—");

  const groups = useMemo(
    () =>
      groupPosActivityProductsBySalesType({
        detail,
        cartSnapshot,
        salesTypeNameById,
        unknownSalesTypeLabel: unknownLabel,
      }),
    [cartSnapshot, detail, salesTypeNameById, unknownLabel],
  );

  return (
    <section className="mt-5 border-t border-slate-200 pt-4">
      <h2 className="mb-2 border-b border-slate-200 pb-2 text-sm font-bold uppercase tracking-wide text-slate-900">
        {t(POS_ACTIVITY_I18N.productsSection, "PRODUCTS")}
      </h2>

      <div className="space-y-1">
        {groups.map((group) => (
          <PosActivityProductGroupBlock key={group.key} group={group} />
        ))}
      </div>

      <PosActivityTotalsBlock
        detail={detail}
        applicationMethod={applicationMethod}
        taxLabel={taxLabel}
        gratuityLabel={gratuityLabel}
      />
    </section>
  );
}
