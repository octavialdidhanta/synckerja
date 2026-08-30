import { UserRound } from "lucide-react";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { isGenericCustomerName } from "@/pos-receipt-feedback/lib/isGenericCustomerName";
import { cn } from "@/shared/lib/utils";
import { POS_LOYALTY_I18N } from "../../lib/posLoyaltyCopy";
import type { PosLoyaltyCustomer } from "../../hooks/usePosCustomerPhoneLookup";

type Props = {
  customer: PosLoyaltyCustomer | null;
  checked: boolean;
  phoneLocal: string;
  onOpenSaveName: () => void;
};

function displayPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("62") && digits.length > 2) return `+62 ${digits.slice(2)}`;
  if (digits.startsWith("0") && digits.length > 1) return `+62 ${digits.slice(1)}`;
  return phone;
}

export function PosLoyaltyCheckResult({
  customer,
  checked,
  phoneLocal,
  onOpenSaveName,
}: Props) {
  const { t } = useAppTranslation();
  if (!checked) return null;

  const found = Boolean(customer);
  const name = customer?.name?.trim() || "";
  const generic = !found || isGenericCustomerName(name);

  return (
    <button
      type="button"
      className={cn(
        "mt-3 w-full rounded-xl border-2 px-4 py-4 text-left transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        found
          ? "border-emerald-200 bg-emerald-50 hover:bg-emerald-100/80"
          : "border-amber-200 bg-amber-50 hover:bg-amber-100/80",
      )}
      onClick={onOpenSaveName}
    >
      <span className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
            found ? "bg-emerald-200 text-emerald-800" : "bg-amber-200 text-amber-800",
          )}
        >
          <UserRound className="h-6 w-6" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block text-xs font-semibold uppercase tracking-wide",
              found ? "text-emerald-700" : "text-amber-800",
            )}
          >
            {found
              ? t(POS_LOYALTY_I18N.foundTitle, "Member found")
              : t(POS_LOYALTY_I18N.notFoundTitle, "Member not found")}
          </span>
          <span className="mt-1 block truncate text-xl font-semibold leading-tight text-slate-900">
            {found
              ? generic
                ? t(POS_LOYALTY_I18N.unnamedMember, "No name yet")
                : name
              : t(POS_LOYALTY_I18N.registerNewMember, "Register this number")}
          </span>
          <span className="mt-0.5 block text-base text-slate-600">
            {customer?.phone
              ? displayPhone(customer.phone)
              : phoneLocal
                ? displayPhone(`62${phoneLocal}`)
                : null}
          </span>
          <span className="mt-2 block text-sm leading-snug text-slate-600">
            {found && !generic
              ? t(
                  POS_LOYALTY_I18N.foundHint,
                  "Already selected. Tap Continue to pay. Tap this card only to change the name.",
                )
              : t(
                  POS_LOYALTY_I18N.tapToSetName,
                  "Tap this card to save a name",
                )}
          </span>
        </span>
      </span>
    </button>
  );
}
