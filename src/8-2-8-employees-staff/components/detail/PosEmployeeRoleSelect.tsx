import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import {
  useEnsurePosDefaultRoles,
  usePosEmployeeRoles,
  type PosEmployeeRoleRow,
} from "../../hooks/usePosEmployeeRoles";

type Props = {
  value: string | null;
  onChange: (role: PosEmployeeRoleRow) => void;
  disabled?: boolean;
  id?: string;
};

function displayRoleName(
  role: Pick<PosEmployeeRoleRow, "name" | "slug">,
  t: (key: string, fallback: string) => string,
): string {
  if (role.slug === "administrator") {
    return t("employeesStaff.role.administrator", "Administrator");
  }
  if (role.slug === "cashier") {
    return t("employeesStaff.role.cashier", "Cashier");
  }
  return role.name;
}

/** Select any org POS employee role (system + custom) from `pos_employee_roles`. */
export function PosEmployeeRoleSelect({ value, onChange, disabled, id }: Props) {
  const { t } = useAppTranslation();
  const { roles, isLoading } = usePosEmployeeRoles();
  useEnsurePosDefaultRoles(!isLoading);

  return (
    <Select
      value={value ?? undefined}
      onValueChange={(nextId) => {
        const role = roles.find((r) => r.id === nextId);
        if (role) onChange(role);
      }}
      disabled={disabled || isLoading || roles.length === 0}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue
          placeholder={
            isLoading
              ? t("common.loading", "Loading…")
              : t("employeesStaff.detail.role", "Employee Role")
          }
        />
      </SelectTrigger>
      <SelectContent>
        {roles.map((role) => (
          <SelectItem key={role.id} value={role.id}>
            {displayRoleName(role, t)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
