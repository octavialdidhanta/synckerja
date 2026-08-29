import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { formatPosRatePercent } from "../../lib/formatPosRatePercent";

type Props = {
  name: string;
  amountPercent: number;
};

/** Shared name | percent row for tax & surcharge lists. */
export function PosRatePercentRow({ name, amountPercent }: Props) {
  const { language } = useAppTranslation();

  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-1 py-3 last:border-b-0">
      <span className="min-w-0 flex-1 truncate text-sm text-slate-900">{name}</span>
      <span className="flex-shrink-0 text-sm tabular-nums text-slate-900">
        {formatPosRatePercent(amountPercent, language)}
      </span>
    </div>
  );
}
