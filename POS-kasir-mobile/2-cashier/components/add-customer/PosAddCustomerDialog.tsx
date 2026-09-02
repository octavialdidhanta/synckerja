import { useEffect, useState } from "react";
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
  isUsablePosCheckoutName,
  lookupPosCheckoutLeadByPhone,
} from "@/5-2-customer-visits/checkout/pos-bind";
import { isGenericCustomerName } from "@/pos-receipt-feedback/lib/isGenericCustomerName";
import { POS_CASHIER_I18N } from "../../lib/posCashierCopy";
import { POS_LOYALTY_I18N } from "../../lib/posLoyaltyCopy";
import {
  posCashierCustomerFromLead,
  posMemberPhoneLocalDigits,
  posSessionOnlyGuest,
  type PosCashierCustomer,
} from "../../lib/posCashierCustomer";
import { shouldLockPosMemberName } from "../../lib/posMemberNameLock";
import { usePosCustomerPhoneLookup } from "../../hooks/usePosCustomerPhoneLookup";
import {
  PosMemberLookupPanel,
  PosMemberSaveNameSheet,
  type PosMemberLookupCustomer,
} from "../member-lookup";

export type { PosCashierCustomer };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: PosCashierCustomer | null;
  onSave: (customer: PosCashierCustomer) => void;
  onRemove?: () => void;
};

export function PosAddCustomerDialog({
  open,
  onOpenChange,
  initial,
  onSave,
  onRemove,
}: Props) {
  const { t } = useAppTranslation();
  const { organizationId } = useCurrentOrg();
  const lookup = usePosCustomerPhoneLookup();
  const [phoneLocal, setPhoneLocal] = useState("");
  const [checked, setChecked] = useState(false);
  const [found, setFound] = useState<PosMemberLookupCustomer | null>(null);
  const [saveNameOpen, setSaveNameOpen] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [guestOpen, setGuestOpen] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestError, setGuestError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const local = posMemberPhoneLocalDigits(initial?.phone);
    setPhoneLocal(local);
    setChecked(Boolean(initial?.boundByPhone && initial.leadId && local));
    setFound(
      initial?.boundByPhone && initial.leadId
        ? { id: initial.leadId, name: initial.name, phone: initial.phone }
        : null,
    );
    setSaveNameOpen(false);
    setSavingName(false);
    setGuestOpen(false);
    setGuestName(initial && !initial.phone.trim() ? initial.name : "");
    setGuestError(null);
    // Snapshot guest only when opening so a late hydrate cannot wipe Check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const attach = (next: PosCashierCustomer) => {
    onSave(next);
    onOpenChange(false);
  };

  const runCheck = async () => {
    setChecked(false);
    setFound(null);
    try {
      const result = await lookup.mutateAsync(phoneLocal);
      setFound(result);
      setChecked(true);
    } catch {
      setFound(null);
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
      attach(
        posCashierCustomerFromLead({
          leadId: matched?.lead?.id ?? ensured.leadId,
          client: matched?.lead?.client ?? name,
          phone,
          typedName: name,
        }),
      );
    } finally {
      setSavingName(false);
    }
  };

  const useFoundMember = () => {
    if (!found?.id) return;
    attach(
      posCashierCustomerFromLead({
        leadId: found.id,
        client: found.name,
        phone: found.phone,
      }),
    );
  };

  const foundLocked = Boolean(found && shouldLockPosMemberName(found.name));
  const foundGeneric = Boolean(found && isGenericCustomerName(found.name));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[min(90dvh,640px)] max-h-[min(90dvh,640px)] w-[min(92vw,560px)] max-w-none flex-col gap-0 overflow-hidden rounded-xl border-0 p-0 shadow-xl [&>button]:hidden"
        aria-describedby={undefined}
      >
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="relative flex shrink-0 items-center justify-center border-b border-slate-100 px-3 py-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="absolute left-3 top-1/2 -translate-y-1/2 border-primary text-primary"
              onClick={() => onOpenChange(false)}
            >
              {t(POS_CASHIER_I18N.customerSkip, "Skip")}
            </Button>
            <DialogTitle className="text-base font-semibold">
              {t(POS_CASHIER_I18N.addCustomerTitle, "Add customer")}
            </DialogTitle>
          </div>

          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-4 py-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <PosMemberLookupPanel
              phoneLocal={phoneLocal}
              onPhoneLocalChange={(value) => {
                setPhoneLocal(value);
                setChecked(false);
                setFound(null);
              }}
              checking={lookup.isPending}
              checked={checked}
              customer={found}
              onCheck={() => void runCheck()}
              onOpenSaveName={() => setSaveNameOpen(true)}
            />

            {initial ? (
              <Button
                type="button"
                variant="ghost"
                className="mt-4 h-10 w-full text-destructive hover:text-destructive"
                onClick={() => {
                  onRemove?.();
                  onOpenChange(false);
                }}
              >
                {t(POS_CASHIER_I18N.customerRemove, "Remove from bill")}
              </Button>
            ) : null}

            <div className="mt-6 border-t border-slate-100 pt-4">
              <button
                type="button"
                className="text-sm font-medium text-primary underline-offset-2 hover:underline"
                onClick={() => setGuestOpen((v) => !v)}
              >
                {t(POS_CASHIER_I18N.guestWithoutPhone, "Guest without a phone")}
              </button>
              {guestOpen ? (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-slate-500">
                    {t(
                      POS_CASHIER_I18N.guestWithoutPhoneHint,
                      "Name only on this bill. Not saved as a loyalty member.",
                    )}
                  </p>
                  <Input
                    value={guestName}
                    onChange={(e) => {
                      setGuestName(e.target.value);
                      setGuestError(null);
                    }}
                    placeholder={t(POS_CASHIER_I18N.guestNamePlaceholder, "Guest name")}
                    className="h-11"
                  />
                  {guestError ? (
                    <p className="text-xs text-destructive">{guestError}</p>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-full"
                    onClick={() => {
                      if (!isUsablePosCheckoutName(guestName)) {
                        setGuestError(
                          t(POS_LOYALTY_I18N.nameTooShort, "Enter at least 2 letters."),
                        );
                        return;
                      }
                      attach(posSessionOnlyGuest(guestName.trim()));
                    }}
                  >
                    {t(POS_CASHIER_I18N.guestWithoutPhoneSave, "Save guest on bill")}
                  </Button>
                </div>
              ) : null}
            </div>
          </div>

          {checked && foundLocked ? (
            <div className="shrink-0 border-t border-slate-100 p-3">
              <Button type="button" className="h-11 w-full" onClick={useFoundMember}>
                {t(POS_CASHIER_I18N.useThisMember, "Use this member")}
              </Button>
            </div>
          ) : null}

          {checked && (!found || foundGeneric) ? (
            <div className="shrink-0 border-t border-slate-100 p-3">
              <Button
                type="button"
                className="h-11 w-full"
                onClick={() => setSaveNameOpen(true)}
              >
                {t(POS_LOYALTY_I18N.saveName, "Save name")}
              </Button>
            </div>
          ) : null}

          <PosMemberSaveNameSheet
            open={saveNameOpen}
            phoneLocal={phoneLocal}
            initialName={found && !isGenericCustomerName(found.name) ? found.name : ""}
            saving={savingName}
            hideContinueWithoutName
            onSave={(name) => void persistName(name)}
            onClose={() => setSaveNameOpen(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
