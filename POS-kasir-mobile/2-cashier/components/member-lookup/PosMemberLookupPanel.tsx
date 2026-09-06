import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { POS_PANEL } from "@/pos-mobile/shared/lib/posPanelChrome";
import { POS_CASHIER_I18N } from "../../lib/posCashierCopy";
import { POS_LOYALTY_I18N } from "../../lib/posLoyaltyCopy";
import { sanitizePosPhoneLocalInput } from "../../lib/posCashierCustomer";
import { shouldLockPosMemberName } from "../../lib/posMemberNameLock";
import { PosMemberCheckResult } from "./PosMemberCheckResult";
import type { PosMemberLookupCustomer } from "./types";

type Props = {
  phoneLocal: string;
  onPhoneLocalChange: (value: string) => void;
  email: string;
  onEmailChange: (value: string) => void;
  emailError?: string | null;
  checking: boolean;
  checked: boolean;
  customer: PosMemberLookupCustomer | null;
  onCheck: () => void;
  onOpenSaveName: () => void;
};

export function PosMemberLookupPanel({
  phoneLocal,
  onPhoneLocalChange,
  email,
  onEmailChange,
  emailError,
  checking,
  checked,
  customer,
  onCheck,
  onOpenSaveName,
}: Props) {
  const { t } = useAppTranslation();
  const emailLocked = Boolean(
    customer &&
      shouldLockPosMemberName(customer.name) &&
      String(customer.email ?? "").trim(),
  );

  return (
    <div>
      <p className={POS_PANEL.sectionTitle}>
        {t(POS_LOYALTY_I18N.registerOrSearch, "Register or find member")}
      </p>
      <div className="flex gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-slate-200 bg-white px-2">
          <span className="shrink-0 text-sm font-medium text-slate-600">+62</span>
          <Input
            value={phoneLocal}
            onChange={(e) =>
              onPhoneLocalChange(sanitizePosPhoneLocalInput(e.target.value))
            }
            placeholder={t(POS_LOYALTY_I18N.phonePlaceholder, "812…")}
            className="h-10 border-0 shadow-none focus-visible:ring-0"
            inputMode="tel"
          />
        </div>
        <Button
          type="button"
          className="h-10 shrink-0 px-4"
          disabled={checking || phoneLocal.length < 8}
          onClick={onCheck}
        >
          {t(POS_LOYALTY_I18N.check, "Check")}
        </Button>
      </div>

      <label className="mt-3 block">
        <span className={POS_PANEL.sectionTitle}>
          {t(POS_CASHIER_I18N.customerEmail, "Email (optional)")}
        </span>
        <Input
          type="email"
          value={email}
          onChange={(e) => {
            if (emailLocked) return;
            onEmailChange(e.target.value);
          }}
          placeholder={t(POS_CASHIER_I18N.customerEmailHint, "name@email.com")}
          className="h-10 border-slate-200 bg-white"
          autoComplete="email"
          readOnly={emailLocked}
          aria-readonly={emailLocked}
        />
        {emailError ? (
          <p className="mt-1 text-xs text-destructive">{emailError}</p>
        ) : emailLocked ? (
          <p className="mt-1 text-xs text-slate-500">
            {t(
              POS_CASHIER_I18N.customerEmailLockedHint,
              "Email comes from CRM and cannot be changed here.",
            )}
          </p>
        ) : null}
      </label>

      <PosMemberCheckResult
        customer={customer}
        checked={checked}
        phoneLocal={phoneLocal}
        onOpenSaveName={onOpenSaveName}
      />
    </div>
  );
}
