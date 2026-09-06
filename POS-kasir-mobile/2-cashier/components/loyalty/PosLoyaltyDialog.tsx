import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { cn } from "@/shared/lib/utils";
import { supabase } from "@/shared/lib/supabaseClient";
import { normalizeCustomerVisitPhone } from "@/5-2-customer-visits/lib/normalizeCustomerVisitPhone";
import {
  ensurePosCheckoutLead,
  lookupPosCheckoutLeadByPhone,
  POS_CHECKOUT_WALK_IN_CLIENT,
} from "@/5-2-customer-visits/checkout/pos-bind";
import { isGenericCustomerName, personalCustomerName } from "@/pos-receipt-feedback/lib/isGenericCustomerName";
import { POS_PANEL } from "@/pos-mobile/shared/lib/posPanelChrome";
import { usePosKeyboardDock } from "@/pos-mobile/shared/hooks/usePosKeyboardDock";
import { usePosKeyboardShellStyle } from "@/pos-mobile/shared/hooks/usePosKeyboardShellStyle";
import { PosSafeAreaBottomSpacer } from "@/pos-mobile/shared/layout/PosSafeAreaBottomSpacer";
import { PosSafeAreaTopSpacer } from "@/pos-mobile/shared/layout/PosSafeAreaTopSpacer";
import { POS_CASHIER_I18N } from "../../lib/posCashierCopy";
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
import {
  isOptionalCustomerEmailOk,
  normalizeOptionalCustomerEmail,
} from "../../lib/isPosCustomerEmail";
import { shouldLockPosMemberName } from "../../lib/posMemberNameLock";
import {
  resolvePosCheckoutEmailForCart,
  syncEmailFieldAfterMemberCheck,
} from "../../lib/posMemberEmailLock";
import { usePosCashierIsPhoneLayout } from "../../hooks/usePosCashierIsPhoneLayout";
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
  email?: string,
): PosLoyaltyCustomer {
  const phone = normalizeCustomerVisitPhone(phoneLocal) ?? phoneLocal;
  const name = existing?.name?.trim();
  return {
    id: existing?.id ?? null,
    name: name && !isGenericCustomerName(name) ? name : POS_CHECKOUT_WALK_IN_CLIENT,
    phone,
    email: email || existing?.email || null,
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
  const keyboardShellStyle = usePosKeyboardShellStyle();
  const keyboardDock = usePosKeyboardDock({
    enabled: open && isPhone,
    scrollIntoView: false,
  });
  const { organizationId } = useCurrentOrg();
  const lookup = usePosCustomerPhoneLookup();
  const rewardsQuery = usePosOutletRewards(outletId);
  const [phoneLocal, setPhoneLocal] = useState("");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
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
    setEmail(prefill.customer?.email?.trim() || initialCustomer?.email?.trim() || "");
    setEmailError(null);
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

  const typedEmailOrBlock = (): string | false => {
    if (!isOptionalCustomerEmailOk(email)) {
      setEmailError(
        t(POS_CASHIER_I18N.customerEmailInvalid, "Enter a valid email address"),
      );
      return false;
    }
    setEmailError(null);
    return normalizeOptionalCustomerEmail(email);
  };

  const runCheck = async () => {
    setChecked(false);
    try {
      const found = await lookup.mutateAsync(phoneLocal);
      setCustomer(found);
      setChecked(true);
      setEmail(
        syncEmailFieldAfterMemberCheck({
          crmEmail: found?.email,
          currentField: email,
          memberName: found?.name,
        }),
      );
      setEmailError(null);
    } catch {
      setCustomer(null);
      setChecked(true);
    }
  };

  const persistName = async (name: string) => {
    if (!organizationId) return;
    const typedEmail = typedEmailOrBlock();
    if (typedEmail === false) return;
    const cartEmail = resolvePosCheckoutEmailForCart({
      crmEmail: customer?.email,
      typedEmail,
      lockCrmEmail: shouldLockPosMemberName(customer?.name ?? name),
    });
    setSavingName(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const ensured = await ensurePosCheckoutLead({
        organizationId,
        phone: phoneLocal,
        email: cartEmail || null,
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
      const nextName = personalCustomerName(matched?.lead?.client) ?? name;
      const crmEmail = matched?.lead?.email ?? customer?.email ?? null;
      setCustomer({
        id: matched?.lead?.id ?? ensured.leadId,
        name: nextName,
        phone,
        email: resolvePosCheckoutEmailForCart({
          crmEmail,
          typedEmail: cartEmail,
          lockCrmEmail: shouldLockPosMemberName(nextName),
        }) || null,
      });
      setChecked(true);
      setSaveNameOpen(false);
    } finally {
      setSavingName(false);
    }
  };

  const continueWithoutName = () => {
    const typedEmail = typedEmailOrBlock();
    if (typedEmail === false) return;
    const cartEmail = resolvePosCheckoutEmailForCart({
      crmEmail: customer?.email,
      typedEmail,
      lockCrmEmail: shouldLockPosMemberName(customer?.name),
    });
    setCustomer(customerFromPhone(phoneLocal, customer, cartEmail || undefined));
    setChecked(true);
    setSaveNameOpen(false);
  };

  const handleContinue = () => {
    const typedEmail = typedEmailOrBlock();
    if (typedEmail === false) return;
    if (customer) {
      const cartEmail = resolvePosCheckoutEmailForCart({
        crmEmail: customer.email,
        typedEmail,
        lockCrmEmail: shouldLockPosMemberName(customer.name),
      });
      onContinue({
        customer: {
          ...customer,
          email: cartEmail || null,
        },
        reward: selectedReward,
      });
      return;
    }
    if (phoneLocal.length >= 8) {
      onContinue({
        customer: customerFromPhone(phoneLocal, null, typedEmail || undefined),
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
  const memberFound = checked && Boolean(customer);

  const header = (titleNode: ReactNode) => (
    <div className="flex-shrink-0 border-b border-slate-200 bg-white">
      <div className={cn(POS_PANEL.header, "border-b-0")}>
        <button
          type="button"
          onClick={onBack}
          className={POS_PANEL.headerBack}
          aria-label={t(POS_LOYALTY_I18N.cancel, "Cancel")}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">{titleNode}</div>
        <button
          type="button"
          disabled={memberFound}
          onClick={onSkip}
          className={cn(
            "inline-flex h-10 min-w-[3.5rem] flex-shrink-0 items-center justify-center rounded-md px-2 text-sm font-semibold text-primary transition hover:bg-primary/10",
            "disabled:pointer-events-none disabled:opacity-40",
          )}
        >
          {t(POS_LOYALTY_I18N.skip, "Skip")}
        </button>
      </div>
    </div>
  );

  const body = (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-100">
      <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className={POS_PANEL.body}>
          <p className="mb-2 px-0.5 text-xs leading-relaxed text-slate-500">
            {t(
              POS_LOYALTY_I18N.pointsHint,
              "Look up a member or skip to payment",
            )}
          </p>

          <div className={cn(POS_PANEL.card, "p-3")}>
            <PosMemberLookupPanel
              phoneLocal={phoneLocal}
              onPhoneLocalChange={(value) => {
                setPhoneLocal(value);
                setChecked(false);
                setCustomer(null);
              }}
              email={email}
              onEmailChange={(value) => {
                setEmail(value);
                setEmailError(null);
              }}
              emailError={emailError}
              checking={lookup.isPending}
              checked={checked}
              customer={customer}
              onCheck={() => void runCheck()}
              onOpenSaveName={() => {
                if (typedEmailOrBlock() === false) return;
                setSaveNameOpen(true);
              }}
            />
          </div>

          <PosLoyaltyRewardsList
            rewards={rewards}
            selectedRewardId={selectedRewardId}
            open={rewardsOpen}
            onToggleOpen={() => setRewardsOpen((v) => !v)}
            onSelect={setSelectedRewardId}
          />
        </div>
      </div>

      <div
        className={cn(
          "shrink-0 border-t border-slate-200 bg-white px-2 sm:px-2.5",
          keyboardDock.keyboardOpen ? "pt-3 pb-1" : "py-3",
        )}
      >
        <Button type="button" className="h-11 w-full text-sm font-semibold" onClick={handleContinue}>
          {t(POS_LOYALTY_I18N.continue, "Continue")}
        </Button>
      </div>
      {isPhone && !keyboardDock.keyboardOpen ? (
        <PosSafeAreaBottomSpacer className="bg-white" />
      ) : null}

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
      <div
        className="fixed inset-0 z-[70] flex flex-col overflow-hidden bg-slate-100"
        style={keyboardShellStyle}
      >
        <PosSafeAreaTopSpacer />
        {header(
          <h1 className={cn(POS_PANEL.headerTitle, "leading-none")}>{titleText}</h1>,
        )}
        {body}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="flex h-[min(90dvh,720px)] max-h-[min(90dvh,720px)] w-[min(92vw,560px)] max-w-none flex-col gap-0 overflow-hidden rounded-lg border border-slate-200/80 bg-slate-100 p-0 shadow-sm [&>button]:hidden"
        aria-describedby={undefined}
      >
        {header(
          <DialogTitle className={cn(POS_PANEL.headerTitle, "leading-none")}>
            {titleText}
          </DialogTitle>,
        )}
        {body}
      </DialogContent>
    </Dialog>
  );
}
