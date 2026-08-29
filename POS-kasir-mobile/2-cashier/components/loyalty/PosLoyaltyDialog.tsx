import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import { POS_LOYALTY_I18N } from "../../lib/posLoyaltyCopy";
import {
  usePosCustomerPhoneLookup,
  type PosLoyaltyCustomer,
} from "../../hooks/usePosCustomerPhoneLookup";
import {
  usePosOutletRewards,
  type PosOutletReward,
} from "../../hooks/usePosOutletRewards";

export type PosLoyaltyResult = {
  customer: PosLoyaltyCustomer | null;
  reward: PosOutletReward | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outletId: string;
  onSkip: () => void;
  onContinue: (result: PosLoyaltyResult) => void;
  onBack: () => void;
};

export function PosLoyaltyDialog({
  open,
  onOpenChange,
  outletId,
  onSkip,
  onContinue,
  onBack,
}: Props) {
  const { t } = useAppTranslation();
  const lookup = usePosCustomerPhoneLookup();
  const rewardsQuery = usePosOutletRewards(outletId);
  const [phoneLocal, setPhoneLocal] = useState("");
  const [customer, setCustomer] = useState<PosLoyaltyCustomer | null>(null);
  const [lookupMsg, setLookupMsg] = useState<string | null>(null);
  const [selectedRewardId, setSelectedRewardId] = useState<string | null>(null);
  const [rewardsOpen, setRewardsOpen] = useState(true);

  useEffect(() => {
    if (!open) return;
    setPhoneLocal("");
    setCustomer(null);
    setLookupMsg(null);
    setSelectedRewardId(null);
    setRewardsOpen(true);
  }, [open]);

  const rewards = rewardsQuery.data ?? [];
  const selectedReward =
    rewards.find((r) => r.id === selectedRewardId) ?? null;

  const runCheck = async () => {
    setLookupMsg(null);
    try {
      const found = await lookup.mutateAsync(phoneLocal);
      setCustomer(found);
      setLookupMsg(
        found
          ? t(POS_LOYALTY_I18N.found, "Member found: {{name}}", {
              name: found.name,
            })
          : t(POS_LOYALTY_I18N.notFound, "Member not found"),
      );
    } catch (err) {
      setCustomer(null);
      setLookupMsg(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onBack();
        onOpenChange(next);
      }}
    >
      <DialogContent
        className="flex max-h-[min(82dvh,640px)] w-[min(92vw,520px)] max-w-none flex-col gap-0 overflow-hidden rounded-xl border-0 p-0 shadow-xl [&>button]:hidden"
        aria-describedby={undefined}
      >
        <div className="relative flex items-center justify-center border-b border-slate-100 px-3 py-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="absolute left-3 top-1/2 -translate-y-1/2 border-primary text-primary"
            onClick={onBack}
          >
            {t(POS_LOYALTY_I18N.cancel, "Cancel")}
          </Button>
          <DialogTitle className="text-base font-semibold">
            {t(POS_LOYALTY_I18N.title, "Loyalty Program")}
          </DialogTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="absolute right-3 top-1/2 -translate-y-1/2 border-primary text-primary"
            onClick={onSkip}
          >
            {t(POS_LOYALTY_I18N.skip, "Skip")}
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="mb-4 flex flex-col items-center text-center">
            <span className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-sky-100 text-sky-600">
              <Trophy className="h-7 w-7" aria-hidden />
            </span>
            <p className="text-sm text-slate-600">
              {t(
                POS_LOYALTY_I18N.pointsHint,
                "Look up a member or skip to payment",
              )}
            </p>
          </div>

          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {t(POS_LOYALTY_I18N.registerOrSearch, "Register or find member")}
          </p>
          <div className="flex gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-slate-200 px-2">
              <span className="shrink-0 text-sm font-medium text-slate-600">+62</span>
              <Input
                value={phoneLocal}
                onChange={(e) => setPhoneLocal(e.target.value.replace(/\D/g, ""))}
                placeholder={t(POS_LOYALTY_I18N.phonePlaceholder, "812…")}
                className="h-10 border-0 shadow-none focus-visible:ring-0"
                inputMode="tel"
              />
            </div>
            <Button
              type="button"
              className="h-10 shrink-0 px-4"
              disabled={lookup.isPending || phoneLocal.length < 8}
              onClick={() => void runCheck()}
            >
              {t(POS_LOYALTY_I18N.check, "Check")}
            </Button>
          </div>
          {lookupMsg ? (
            <p className="mt-2 text-xs text-slate-600">{lookupMsg}</p>
          ) : null}

          <div className="mt-5 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {t(POS_LOYALTY_I18N.rewardsHeading, "Reward list")}
            </p>
            <button
              type="button"
              className="text-xs font-medium text-primary"
              onClick={() => setRewardsOpen((v) => !v)}
            >
              {rewardsOpen
                ? t(POS_LOYALTY_I18N.hide, "Hide")
                : t(POS_LOYALTY_I18N.show, "Show")}
            </button>
          </div>

          {rewardsOpen ? (
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
                        onClick={() =>
                          setSelectedRewardId((id) =>
                            id === reward.id ? null : reward.id,
                          )
                        }
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
        </div>

        <div className="border-t border-slate-100 p-3">
          <Button
            type="button"
            className="h-11 w-full"
            onClick={() =>
              onContinue({
                customer,
                reward: selectedReward,
              })
            }
          >
            {t(POS_LOYALTY_I18N.continue, "Continue")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
