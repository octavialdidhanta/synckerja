import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { POS_LOYALTY_I18N } from "../../lib/posLoyaltyCopy";
import { PosMemberCheckResult } from "./PosMemberCheckResult";
import type { PosMemberLookupCustomer } from "./types";

type Props = {
  phoneLocal: string;
  onPhoneLocalChange: (value: string) => void;
  checking: boolean;
  checked: boolean;
  customer: PosMemberLookupCustomer | null;
  onCheck: () => void;
  onOpenSaveName: () => void;
};

export function PosMemberLookupPanel({
  phoneLocal,
  onPhoneLocalChange,
  checking,
  checked,
  customer,
  onCheck,
  onOpenSaveName,
}: Props) {
  const { t } = useAppTranslation();

  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {t(POS_LOYALTY_I18N.registerOrSearch, "Register or find member")}
      </p>
      <div className="flex gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-slate-200 px-2">
          <span className="shrink-0 text-sm font-medium text-slate-600">+62</span>
          <Input
            value={phoneLocal}
            onChange={(e) => onPhoneLocalChange(e.target.value.replace(/\D/g, ""))}
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
      <PosMemberCheckResult
        customer={customer}
        checked={checked}
        phoneLocal={phoneLocal}
        onOpenSaveName={onOpenSaveName}
      />
    </div>
  );
}
