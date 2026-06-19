import { useTranslation } from "react-i18next";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useXenditSubAccountOptions } from "@/xendit/hooks/useXenditSubAccountOptions";
import type { XenditSubAccountRow } from "@/xendit/types/xendit";

const ALL_VALUE = "__all__";

type XenditSubAccountSelectProps = {
  subAccounts: XenditSubAccountRow[] | undefined;
  value: string | null;
  onChange: (xenditSubAccountId: string | null) => void;
  includeAll?: boolean;
  disabled?: boolean;
  className?: string;
};

export function XenditSubAccountSelect({
  subAccounts,
  value,
  onChange,
  includeAll = true,
  disabled = false,
  className,
}: XenditSubAccountSelectProps) {
  const { t } = useTranslation();
  const options = useXenditSubAccountOptions(subAccounts);

  if (options.length === 0) return null;

  const selectValue = value ?? (includeAll ? ALL_VALUE : options[0]?.xenditSubAccountId ?? ALL_VALUE);

  return (
    <Select
      value={selectValue}
      onValueChange={(v) => onChange(v === ALL_VALUE ? null : v)}
      disabled={disabled}
    >
      <SelectTrigger className={className ?? "h-9 w-full max-w-xs text-xs"}>
        <SelectValue placeholder={t("xendit.subAccount.selectPlaceholder", "Pilih akun")} />
      </SelectTrigger>
      <SelectContent>
        {includeAll ? (
          <SelectItem value={ALL_VALUE}>
            {t("xendit.subAccount.allAccounts", "Semua akun")}
          </SelectItem>
        ) : null}
        {options.map((opt) => (
          <SelectItem key={opt.xenditSubAccountId} value={opt.xenditSubAccountId}>
            {opt.label}
            {opt.isPrimary
              ? ` (${t("xendit.subAccount.primaryBadge", "Utama")})`
              : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export { ALL_VALUE as XENDIT_SUB_ACCOUNT_ALL_VALUE };
