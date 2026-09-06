import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "@/shared/components/ui/drawer";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { usePhoneDrawerKeyboardChrome } from "@/shared/hooks/usePhoneDrawerKeyboardChrome";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { cn } from "@/shared/lib/utils";
import { supabase } from "@/shared/lib/supabaseClient";
import { normalizeCustomerVisitPhone } from "@/5-2-customer-visits/lib/normalizeCustomerVisitPhone";
import {
  ensurePosCheckoutLead,
  isUsablePosCheckoutName,
  lookupPosCheckoutLeadByPhone,
} from "@/5-2-customer-visits/checkout/pos-bind";
import { isGenericCustomerName } from "@/pos-receipt-feedback/lib/isGenericCustomerName";
import { POS_PANEL } from "@/pos-mobile/shared/lib/posPanelChrome";
import { usePosKeyboardDock } from "@/pos-mobile/shared/hooks/usePosKeyboardDock";
import { POS_CASHIER_I18N } from "../../lib/posCashierCopy";
import { POS_LOYALTY_I18N } from "../../lib/posLoyaltyCopy";
import {
  posCashierCustomerFromLead,
  posMemberPhoneLocalDigits,
  posSessionOnlyGuest,
  type PosCashierCustomer,
} from "../../lib/posCashierCustomer";
import {
  isOptionalCustomerEmailOk,
  normalizeOptionalCustomerEmail,
} from "../../lib/isPosCustomerEmail";
import { shouldLockPosMemberName } from "../../lib/posMemberNameLock";
import {
  resolvePosCheckoutEmailForCart,
  syncEmailFieldAfterMemberCheck,
} from "../../lib/posMemberEmailLock";
import { usePosCustomerPhoneLookup } from "../../hooks/usePosCustomerPhoneLookup";
import { usePosCashierIsPhoneLayout } from "../../hooks/usePosCashierIsPhoneLayout";
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
  const isPhone = usePosCashierIsPhoneLayout();
  const drawerChrome = usePhoneDrawerKeyboardChrome();
  const keyboardDock = usePosKeyboardDock({
    enabled: open && isPhone,
    /* Bottom drawer: focus scroll runs before IME and jumps the sheet. */
    scrollIntoView: false,
  });
  const { organizationId } = useCurrentOrg();
  const lookup = usePosCustomerPhoneLookup();
  const [phoneLocal, setPhoneLocal] = useState("");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
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
    setEmail(initial?.email?.trim() ?? "");
    setEmailError(null);
    setChecked(Boolean(initial?.boundByPhone && initial.leadId && local));
    setFound(
      initial?.boundByPhone && initial.leadId
        ? {
            id: initial.leadId,
            name: initial.name,
            phone: initial.phone,
            email: initial.email || null,
          }
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
    setFound(null);
    try {
      const result = await lookup.mutateAsync(phoneLocal);
      setFound(result);
      setChecked(true);
      setEmail(
        syncEmailFieldAfterMemberCheck({
          crmEmail: result?.email,
          currentField: email,
          memberName: result?.name,
        }),
      );
      setEmailError(null);
    } catch {
      setFound(null);
      setChecked(true);
    }
  };

  const persistName = async (name: string) => {
    if (!organizationId) return;
    const typedEmail = typedEmailOrBlock();
    if (typedEmail === false) return;
    const lockCrm = shouldLockPosMemberName(found?.name ?? name);
    const cartEmail = resolvePosCheckoutEmailForCart({
      crmEmail: found?.email,
      typedEmail,
      lockCrmEmail: lockCrm,
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
      const crmEmail = matched?.lead?.email ?? found?.email ?? null;
      attach(
        posCashierCustomerFromLead({
          leadId: matched?.lead?.id ?? ensured.leadId,
          client: matched?.lead?.client ?? name,
          phone,
          email: crmEmail,
          typedName: name,
          typedEmail: resolvePosCheckoutEmailForCart({
            crmEmail,
            typedEmail: cartEmail,
            lockCrmEmail: shouldLockPosMemberName(matched?.lead?.client ?? name),
          }),
        }),
      );
    } finally {
      setSavingName(false);
    }
  };

  const useFoundMember = () => {
    if (!found?.id) return;
    const typedEmail = typedEmailOrBlock();
    if (typedEmail === false) return;
    const cartEmail = resolvePosCheckoutEmailForCart({
      crmEmail: found.email,
      typedEmail,
      lockCrmEmail: shouldLockPosMemberName(found.name),
    });
    attach(
      posCashierCustomerFromLead({
        leadId: found.id,
        client: found.name,
        phone: found.phone,
        email: found.email ?? null,
        typedEmail: cartEmail || null,
      }),
    );
  };

  const saveGuest = () => {
    if (!isUsablePosCheckoutName(guestName)) {
      setGuestError(
        t(POS_LOYALTY_I18N.nameTooShort, "Enter at least 2 letters."),
      );
      return;
    }
    attach(posSessionOnlyGuest(guestName.trim()));
  };

  const foundLocked = Boolean(found && shouldLockPosMemberName(found.name));
  const foundGeneric = Boolean(found && isGenericCustomerName(found.name));
  const titleText = t(POS_CASHIER_I18N.addCustomerTitle, "Add customer");
  /**
   * On phone, keep guest fields in a single bottom dock (not inside the scroll body)
   * so focusing the name input does not remount the field when the keyboard opens.
   */
  const dockGuest = isPhone && guestOpen;

  const header = (titleNode: ReactNode) => (
    <div className="flex-shrink-0 border-b border-slate-200 bg-white">
      <div className={cn(POS_PANEL.header, "border-b-0")}>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className={POS_PANEL.headerBack}
          aria-label={t(POS_CASHIER_I18N.customerSkip, "Skip")}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">{titleNode}</div>
      </div>
    </div>
  );

  const guestFields = (
    <div className="space-y-2">
      <p className="text-xs leading-relaxed text-slate-500">
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
        className="h-11 border-slate-200 bg-white"
      />
      {guestError ? (
        <p className="text-xs text-destructive">{guestError}</p>
      ) : null}
      <Button
        type="button"
        variant="outline"
        className="h-11 w-full border-slate-200"
        onClick={saveGuest}
      >
        {t(POS_CASHIER_I18N.guestWithoutPhoneSave, "Save guest on bill")}
      </Button>
    </div>
  );

  const body = (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-100">
      <div
        ref={keyboardDock.scrollRootRef}
        className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        data-vaul-no-drag=""
      >
        <div
          className={cn(
            POS_PANEL.body,
            /* Keep pb stable — swapping pb-8→pb-2 when IME opens jumps content. */
          )}
        >
          <div className={cn(POS_PANEL.card, "p-3")}>
            <PosMemberLookupPanel
              phoneLocal={phoneLocal}
              onPhoneLocalChange={(value) => {
                setPhoneLocal(value);
                setChecked(false);
                setFound(null);
              }}
              email={email}
              onEmailChange={(value) => {
                setEmail(value);
                setEmailError(null);
              }}
              emailError={emailError}
              checking={lookup.isPending}
              checked={checked}
              customer={found}
              onCheck={() => void runCheck()}
              onOpenSaveName={() => {
                if (typedEmailOrBlock() === false) return;
                setSaveNameOpen(true);
              }}
            />
          </div>

          {initial ? (
            <Button
              type="button"
              variant="ghost"
              className="mt-3 h-10 w-full text-destructive hover:bg-red-50 hover:text-destructive"
              onClick={() => {
                onRemove?.();
                onOpenChange(false);
              }}
            >
              {t(POS_CASHIER_I18N.customerRemove, "Remove from bill")}
            </Button>
          ) : null}

          <div className={cn(POS_PANEL.card, "mt-3")}>
            <button
              type="button"
              className={cn(
                POS_PANEL.row,
                "text-left text-sm font-medium transition-colors hover:bg-slate-50",
              )}
              /* Keep IME focus on phone/email — blur would flip drawer chrome (hentakan). */
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => setGuestOpen((v) => !v)}
            >
              <span className={POS_PANEL.rowLabel}>
                {t(POS_CASHIER_I18N.guestWithoutPhone, "Guest without a phone")}
              </span>
              <span className="text-xs font-medium text-slate-500">
                {guestOpen ? "−" : "+"}
              </span>
            </button>
            {guestOpen && !dockGuest ? (
              <div className="border-t border-slate-200 px-3 py-3">{guestFields}</div>
            ) : null}
          </div>
        </div>
      </div>

      {dockGuest ? (
        <div className="shrink-0 border-t border-slate-200 bg-white px-2 pb-2 pt-2 sm:px-2.5">
          {guestFields}
        </div>
      ) : null}

      {checked && foundLocked ? (
        <div className="shrink-0 border-t border-slate-200 bg-white px-2 py-3 sm:px-2.5">
          <Button type="button" className="h-11 w-full" onClick={useFoundMember}>
            {t(POS_CASHIER_I18N.useThisMember, "Use this member")}
          </Button>
        </div>
      ) : null}

      {checked && (!found || foundGeneric) ? (
        <div className="shrink-0 border-t border-slate-200 bg-white px-2 py-3 sm:px-2.5">
          <Button
            type="button"
            className="h-11 w-full"
            onClick={() => {
              if (typedEmailOrBlock() === false) return;
              setSaveNameOpen(true);
            }}
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
  );

  if (isPhone) {
    return (
      <Drawer
        open={open}
        onOpenChange={onOpenChange}
        dismissible
        /* Android adjustResize already shrinks the window; Vaul's default shift
           pushes Skip / title under the rounded top of the sheet. */
        repositionInputs={false}
      >
        <DrawerContent
          aboveAppNav={false}
          smoothFast
          /* adjustResize moves the sheet; vv pin would double-lift / jump on focus. */
          followKeyboard={false}
          className={cn(
            drawerChrome.drawerClassName,
            /* No dvh — dynamic viewport height jumps when the IME opens. */
            "z-[70] rounded-t-2xl border-0 bg-slate-100 shadow-2xl",
          )}
          overlayClassName="z-[70]"
          style={drawerChrome.drawerMaxHeightStyle}
        >
          {header(
            <DrawerTitle className={cn(POS_PANEL.headerTitle, "leading-none")}>
              {titleText}
            </DrawerTitle>,
          )}
          {body}
          <div className="shrink-0" style={drawerChrome.footerStyle} aria-hidden />
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[min(90dvh,640px)] max-h-[min(90dvh,640px)] w-[min(92vw,560px)] max-w-none flex-col gap-0 overflow-hidden rounded-lg border border-slate-200/80 bg-slate-100 p-0 shadow-sm [&>button]:hidden"
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
