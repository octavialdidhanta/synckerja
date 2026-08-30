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
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import { normalizeCustomerVisitPhone } from "@/5-2-customer-visits/lib/normalizeCustomerVisitPhone";
import {
  ensurePosCheckoutLead,
  POS_CHECKOUT_WALK_IN_CLIENT,
} from "@/5-2-customer-visits/checkout/pos-bind";
import { isGenericCustomerName } from "@/pos-receipt-feedback/lib/isGenericCustomerName";
import { POS_LOYALTY_I18N } from "../../lib/posLoyaltyCopy";
import {
  usePosCustomerPhoneLookup,
  type PosLoyaltyCustomer,
} from "../../hooks/usePosCustomerPhoneLookup";
import {
  usePosOutletRewards,
  type PosOutletReward,
} from "../../hooks/usePosOutletRewards";
import { PosLoyaltyCheckResult } from "./PosLoyaltyCheckResult";
import { PosLoyaltySaveNameSheet } from "./PosLoyaltySaveNameSheet";
import { PosLoyaltyRewardsList } from "./PosLoyaltyRewardsList";

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

function customerFromPhone(phoneLocal: string, existing?: PosLoyaltyCustomer | null): PosLoyaltyCustomer {
  const phone = normalizeCustomerVisitPhone(phoneLocal) ?? phoneLocal;
  const name = existing?.name?.trim();
  return {
    id: existing?.id ?? null,
    name: name && !isGenericCustomerName(name) ? name : POS_CHECKOUT_WALK_IN_CLIENT,
    phone,
  };
}

export function PosLoyaltyDialog({
  open,
  onOpenChange,
  outletId,
  onSkip,
  onContinue,
  onBack,
}: Props) {
  const { t } = useAppTranslation();
  const { organizationId } = useCurrentOrg();
  const lookup = usePosCustomerPhoneLookup();
  const rewardsQuery = usePosOutletRewards(outletId);
  const [phoneLocal, setPhoneLocal] = useState("");
  const [customer, setCustomer] = useState<PosLoyaltyCustomer | null>(null);
  const [checked, setChecked] = useState(false);
  const [saveNameOpen, setSaveNameOpen] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [selectedRewardId, setSelectedRewardId] = useState<string | null>(null);
  const [rewardsOpen, setRewardsOpen] = useState(true);

  useEffect(() => {
    if (!open) return;
    setPhoneLocal("");
    setCustomer(null);
    setChecked(false);
    setSaveNameOpen(false);
    setSavingName(false);
    setSelectedRewardId(null);
    setRewardsOpen(true);
  }, [open]);

  const rewards = rewardsQuery.data ?? [];
  const selectedReward = rewards.find((r) => r.id === selectedRewardId) ?? null;

  const runCheck = async () => {
    setChecked(false);
    try {
      const found = await lookup.mutateAsync(phoneLocal);
      setCustomer(found);
      setChecked(true);
    } catch {
      setCustomer(null);
      setChecked(true);
    }
  };

  const persistName = async (name: string) => {
    if (!organizationId) return;
    setSavingName(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const ensured = await ensurePosCheckoutLead({
        organizationId,
        phone: phoneLocal,
        clientName: name,
        userId: user?.id ?? null,
      });
      const phone = normalizeCustomerVisitPhone(phoneLocal) ?? phoneLocal;
      setCustomer({ id: ensured.leadId, name, phone });
      setChecked(true);
      setSaveNameOpen(false);
    } finally {
      setSavingName(false);
    }
  };

  const continueWithoutName = () => {
    setCustomer(customerFromPhone(phoneLocal, customer));
    setChecked(true);
    setSaveNameOpen(false);
  };

  const handleContinue = () => {
    if (customer) {
      onContinue({ customer, reward: selectedReward });
      return;
    }
    if (phoneLocal.length >= 8) {
      onContinue({
        customer: customerFromPhone(phoneLocal),
        reward: selectedReward,
      });
      return;
    }
    onContinue({ customer: null, reward: selectedReward });
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
        className="flex h-[min(90dvh,720px)] max-h-[min(90dvh,720px)] w-[min(92vw,560px)] max-w-none flex-col gap-0 overflow-hidden rounded-xl border-0 p-0 shadow-xl [&>button]:hidden"
        aria-describedby={undefined}
      >
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="relative flex shrink-0 items-center justify-center border-b border-slate-100 px-3 py-3">
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

        <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-4 py-4 [-ms-overflow-style:none] [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden">
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
                onChange={(e) => {
                  setPhoneLocal(e.target.value.replace(/\D/g, ""));
                  setChecked(false);
                  setCustomer(null);
                }}
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
          <PosLoyaltyCheckResult
            customer={customer}
            checked={checked}
            phoneLocal={phoneLocal}
            onOpenSaveName={() => setSaveNameOpen(true)}
          />

          <PosLoyaltyRewardsList
            rewards={rewards}
            selectedRewardId={selectedRewardId}
            open={rewardsOpen}
            onToggleOpen={() => setRewardsOpen((v) => !v)}
            onSelect={setSelectedRewardId}
          />
        </div>

        <div className="shrink-0 border-t border-slate-100 p-3">
          <Button type="button" className="h-11 w-full" onClick={handleContinue}>
            {t(POS_LOYALTY_I18N.continue, "Continue")}
          </Button>
        </div>

        <PosLoyaltySaveNameSheet
          open={saveNameOpen}
          phoneLocal={phoneLocal}
          initialName={
            customer && !isGenericCustomerName(customer.name) ? customer.name : ""
          }
          saving={savingName}
          onSave={(name) => void persistName(name)}
          onContinueWithoutName={continueWithoutName}
          onClose={() => setSaveNameOpen(false)}
        />
        </div>
      </DialogContent>
    </Dialog>
  );
}
