import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/utils";
import {
  BILLING_TERM_OPTIONS,
  formatBillingTermLabel,
  type BillingTermMonths,
} from "@/10-subscription/shared/billingTermUtils";

type BillingTermSelectorProps = {
  value: BillingTermMonths;
  onChange: (months: BillingTermMonths) => void;
  disabled?: boolean;
  disabledTerms?: BillingTermMonths[];
};

export function BillingTermSelector({
  value,
  onChange,
  disabled = false,
  disabledTerms = [],
}: BillingTermSelectorProps) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-4 gap-1 rounded-lg border bg-muted/30 p-1">
      {BILLING_TERM_OPTIONS.map((months) => {
        const isDisabled = disabled || disabledTerms.includes(months);
        const isActive = value === months;
        return (
          <button
            key={months}
            type="button"
            disabled={isDisabled}
            onClick={() => onChange(months)}
            className={cn(
              "rounded-md px-2 py-2 text-xs font-medium transition-colors",
              isActive
                ? "bg-brand-blue text-brand-white shadow-sm"
                : "text-muted-foreground hover:bg-muted",
              isDisabled && "pointer-events-none opacity-40",
            )}
          >
            {formatBillingTermLabel(months, t)}
          </button>
        );
      })}
    </div>
  );
}
