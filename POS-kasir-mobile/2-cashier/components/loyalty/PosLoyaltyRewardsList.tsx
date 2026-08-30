import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { POS_LOYALTY_I18N } from "../../lib/posLoyaltyCopy";
import type { PosOutletReward } from "../../hooks/usePosOutletRewards";

type Props = {
  rewards: PosOutletReward[];
  selectedRewardId: string | null;
  open: boolean;
  onToggleOpen: () => void;
  onSelect: (id: string | null) => void;
};

export function PosLoyaltyRewardsList({
  rewards,
  selectedRewardId,
  open,
  onToggleOpen,
  onSelect,
}: Props) {
  const { t } = useAppTranslation();

  return (
    <>
      <div className="mt-5 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {t(POS_LOYALTY_I18N.rewardsHeading, "Reward list")}
        </p>
        <button
          type="button"
          className="text-xs font-medium text-primary"
          onClick={onToggleOpen}
        >
          {open ? t(POS_LOYALTY_I18N.hide, "Hide") : t(POS_LOYALTY_I18N.show, "Show")}
        </button>
      </div>

      {open ? (
        <ul className="mt-2 divide-y divide-slate-100">
          {rewards.length === 0 ? (
            <li className="py-8 text-center text-sm text-slate-400">
              {t(POS_LOYALTY_I18N.emptyRewards, "No rewards for this outlet.")}
            </li>
          ) : (
            rewards.map((reward) => {
              const active = selectedRewardId === reward.id;
              return (
                <li key={`${reward.kind}:${reward.id}`}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-start justify-between gap-3 py-3 text-left",
                      active && "bg-primary/5",
                    )}
                    onClick={() => onSelect(active ? null : reward.id)}
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-slate-900">
                        {reward.title}
                      </span>
                      {reward.subtitle ? (
                        <span className="block text-xs italic text-slate-500">
                          {reward.subtitle}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-base font-bold text-slate-800">
                      {reward.pointsLabel}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </>
  );
}
