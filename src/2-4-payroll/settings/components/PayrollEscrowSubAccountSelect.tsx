import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useXenditOrgSettings } from "@/xendit/hooks/useXenditOrgSettings";
import { isSubAccountSelectable } from "@/xendit/lib/xenditSubAccountUtils";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

type Props = {
  organizationId: string;
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
};

export function PayrollEscrowSubAccountSelect({
  organizationId,
  value,
  onChange,
  disabled,
}: Props) {
  const { t } = useAppTranslation();
  const { data: xenditSettings, isLoading } = useXenditOrgSettings(organizationId);

  const options = (xenditSettings?.subAccounts ?? []).filter(
    (row) => isSubAccountSelectable(row) && !row.is_primary,
  );

  return (
    <Select
      value={value ?? ""}
      onValueChange={(next) => onChange(next || null)}
      disabled={disabled || isLoading || options.length === 0}
    >
      <SelectTrigger className="h-8 text-xs">
        <SelectValue
          placeholder={t(
            "payroll.escrow.selectSubAccount",
            "Pilih sub-account escrow",
          )}
        />
      </SelectTrigger>
      <SelectContent>
        {options.map((row) => (
          <SelectItem key={row.id} value={row.id}>
            {row.business_name || row.email}
            {row.email ? ` (${row.email})` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
