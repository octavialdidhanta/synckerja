import { useMemo } from "react";
import type { CustomerVisitCartLine } from "@/5-2-customer-visits/checkout/lib/customerVisitCheckout.types";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { POS_PANEL } from "@/pos-mobile/shared/lib/posPanelChrome";
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
    <section className="mt-1">
      <p className={POS_PANEL.sectionTitle}>
        {t(POS_ACTIVITY_I18N.productsSection, "PRODUCTS")}
      </p>
      <div className={POS_PANEL.card}>
        <div className="divide-y divide-slate-200">
          {groups.map((group) => (
            <PosActivityProductGroupBlock key={group.key} group={group} />
          ))}
        </div>
        {/* Double rule: separates ordered items from payment totals */}
        <div className="border-t border-slate-300" aria-hidden />
        <div className="border-t border-slate-300" aria-hidden />
        <PosActivityTotalsBlock
          detail={detail}
          applicationMethod={applicationMethod}
          taxLabel={taxLabel}
          gratuityLabel={gratuityLabel}
        />
      </div>
    </section>
  );
}
