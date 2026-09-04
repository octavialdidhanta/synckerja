import { useEffect, useState, type ReactNode } from "react";
import { Trophy } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
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
  lookupPosCheckoutLeadByPhone,
  POS_CHECKOUT_WALK_IN_CLIENT,
} from "@/5-2-customer-visits/checkout/pos-bind";
import { isGenericCustomerName, personalCustomerName } from "@/pos-receipt-feedback/lib/isGenericCustomerName";
import { POS_LOYALTY_I18N } from "../../lib/posLoyaltyCopy";
import {
  usePosCustomerPhoneLookup,
  type PosLoyaltyCustomer,
} from "../../hooks/usePosCustomerPhoneLookup";
import {
  usePosOutletRewards,
  type PosOutletReward,
} from "../../hooks/usePosOutletRewards";
import { loyaltyOpenStateFromCashier } from "../../lib/posLoyaltyIdentity";
import type { PosCashierCustomer } from "../../lib/posCashierCustomer";
import { usePosCashierIsPhoneLayout } from "../../hooks/usePosCashierIsPhoneLayout";
import { PosSafeAreaTopSpacer } from "@/pos-mobile/shared/layout/PosSafeAreaTopSpacer";
import {
  PosMemberLookupPanel,
  PosMemberSaveNameSheet,
} from "../member-lookup";
import { PosLoyaltyRewardsList } from "./PosLoyaltyRewardsList";

export type PosLoyaltyResult = {
  customer: PosLoyaltyCustomer | null;
  reward: PosOutletReward | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  outletId: string;
  initialCustomer?: PosCashierCustomer | null;
  onSkip: () => void;
  onContinue: (result: PosLoyaltyResult) => void;
  onBack: () => void;
};

function customerFromPhone(
  phoneLocal: string,
  existing?: PosLoyaltyCustomer | null,
): PosLoyaltyCustomer {
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
  initialCustomer,
  onSkip,
  onContinue,
  onBack,
}: Props) {
  const { t } = useAppTranslation();
  const isPhone = usePosCashierIsPhoneLayout();
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
    const prefill = loyaltyOpenStateFromCashier(initialCustomer);
    setPhoneLocal(prefill.phoneLocal);
    setCustomer(prefill.customer);
    setChecked(prefill.checked);
    setSaveNameOpen(false);
    setSavingName(false);
    setSelectedRewardId(null);
    setRewardsOpen(true);
    // Prefill only when the dialog opens so a late session hydrate cannot reset Check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const matched = await lookupPosCheckoutLeadByPhone({
        organizationId,
        rawPhone: phoneLocal,
      });
      const phone =
        matched?.lead?.phone_number ??
        matched?.phoneKey ??
        normalizeCustomerVisitPhone(phoneLocal) ??
        phoneLocal;
      setCustomer({
        id: matched?.lead?.id ?? ensured.leadId,
        name: personalCustomerName(matched?.lead?.client) ?? name,
        phone,
      });
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

  const handleOpenChange = (next: boolean) => {
    if (!next) onBack();
    onOpenChange(next);
  };

  const titleText = t(POS_LOYALTY_I18N.title, "Loyalty Program");

  const header = (titleNode: ReactNode) => (
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
      {titleNode}
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
  );

  const body = (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
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

        <PosMemberLookupPanel
          phoneLocal={phoneLocal}
          onPhoneLocalChange={(value) => {
            setPhoneLocal(value);
            setChecked(false);
            setCustomer(null);
          }}
          checking={lookup.isPending}
          checked={checked}
          customer={customer}
          onCheck={() => void runCheck()}
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

      <div className="shrink-0 border-t border-slate-100 bg-white">
        <div className="px-3 pt-3 pb-3">
          <Button type="button" className="h-11 w-full" onClick={handleContinue}>
            {t(POS_LOYALTY_I18N.continue, "Continue")}
          </Button>
        </div>
        {isPhone ? (
          <div
            aria-hidden
            className="h-[max(0.75rem,env(safe-area-inset-bottom,0px),var(--footer-bottom-inset,0px),3rem)]"
          />
        ) : null}
      </div>

      <PosMemberSaveNameSheet
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
  );

  if (isPhone) {
    if (!open) return null;
    return (
      <div className="fixed inset-0 z-[70] flex flex-col overflow-hidden bg-white">
        <PosSafeAreaTopSpacer />
        {header(<h1 className="text-base font-semibold text-slate-900">{titleText}</h1>)}
        {body}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="flex h-[min(90dvh,720px)] max-h-[min(90dvh,720px)] w-[min(92vw,560px)] max-w-none flex-col gap-0 overflow-hidden rounded-xl border-0 p-0 shadow-xl [&>button]:hidden"
        aria-describedby={undefined}
      >
        {header(
          <DialogTitle className="text-base font-semibold">{titleText}</DialogTitle>,
        )}
        {body}
      </DialogContent>
    </Dialog>
  );
}
