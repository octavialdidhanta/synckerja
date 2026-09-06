import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { POS_PANEL } from "@/pos-mobile/shared/lib/posPanelChrome";
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
      <div className="mt-1 flex items-center justify-between gap-2">
        <p className={cn(POS_PANEL.sectionTitle, "flex-1 pb-1.5 pt-3")}>
          {t(POS_LOYALTY_I18N.rewardsHeading, "Reward list")}
        </p>
        <button
          type="button"
          className="shrink-0 px-0.5 pt-3 text-xs font-semibold text-primary"
          onClick={onToggleOpen}
        >
          {open ? t(POS_LOYALTY_I18N.hide, "Hide") : t(POS_LOYALTY_I18N.show, "Show")}
        </button>
      </div>

      {open ? (
        <div className={POS_PANEL.card}>
          {rewards.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-slate-400">
              {t(POS_LOYALTY_I18N.emptyRewards, "No rewards for this outlet.")}
            </p>
          ) : (
            rewards.map((reward) => {
              const active = selectedRewardId === reward.id;
              return (
                <button
                  key={`${reward.kind}:${reward.id}`}
                  type="button"
                  className={cn(
                    POS_PANEL.row,
                    "items-start text-left transition-colors hover:bg-slate-50",
                    active && "bg-primary/5 hover:bg-primary/10",
                  )}
                  onClick={() => onSelect(active ? null : reward.id)}
                >
                  <span className="min-w-0 flex-1 pr-2">
                    <span className="block text-sm font-medium text-slate-900">
                      {reward.title}
                    </span>
                    {reward.subtitle ? (
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {reward.subtitle}
                      </span>
                    ) : null}
                  </span>
                  <span className={cn(POS_PANEL.rowValue, "pt-0.5")}>
                    {reward.pointsLabel}
                  </span>
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </>
  );
}
