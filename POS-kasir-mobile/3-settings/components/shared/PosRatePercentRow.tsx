import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { POS_PANEL } from "@/pos-mobile/shared/lib/posPanelChrome";
import { formatPosRatePercent } from "../../lib/formatPosRatePercent";

type Props = {
  name: string;
  amountPercent: number;
};

/** Shared name | percent row for tax & surcharge lists. */
export function PosRatePercentRow({ name, amountPercent }: Props) {
  const { language } = useAppTranslation();

  return (
    <div className={POS_PANEL.row}>
      <span className={POS_PANEL.rowLabel}>{name}</span>
      <span className={POS_PANEL.rowValue}>
        {formatPosRatePercent(amountPercent, language)}
      </span>
    </div>
  );
}
