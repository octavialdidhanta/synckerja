/**
 * @deprecated Prefer {@link PosEmployeeRoleSelect} — lists all org POS roles from Access.
 * Kept for any legacy call sites that only need administrator|cashier enum.
 */
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import type { PosStaffRole } from "../../lib/posStaffTypes";

type Props = {
  value: PosStaffRole;
  onChange: (role: PosStaffRole) => void;
  disabled?: boolean;
  id?: string;
};

export function EmployeeRoleSelect({ value, onChange, disabled, id }: Props) {
  const { t } = useAppTranslation();

  return (
    <Select
      value={value}
      onValueChange={(next) => onChange(next as PosStaffRole)}
      disabled={disabled}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="administrator">
          {t("employeesStaff.role.administrator", "Administrator")}
        </SelectItem>
        <SelectItem value="cashier">
          {t("employeesStaff.role.cashier", "Cashier")}
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
