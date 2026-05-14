import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Badge } from "@/shared/components/ui/badge";
import { Briefcase, Crown, ShieldCheck, UserRound, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { formatOrganizationRole } from "@/shared/lib/formatOrganizationRole";
import type { AssignableOrgRole } from "@/2-1-employees/hooks/useUpdateEmployeeOrganizationRole";
import type { Employee } from "@/shared/hooks/employees/useEmployees";
import { useTranslation } from "react-i18next";

export function assignableOrgRoleSelectValue(role: string | null | undefined): AssignableOrgRole {
  return role?.trim().toLowerCase() === "admin" ? "admin" : "employee";
}

function roleIcon(role: string | null | undefined): { Icon: LucideIcon; className: string } {
  const r = (role ?? "").trim().toLowerCase();
  if (r === "owner") return { Icon: Crown, className: "text-amber-600 dark:text-amber-500" };
  if (r === "admin") return { Icon: ShieldCheck, className: "text-brand-blue dark:text-sky-400" };
  if (r === "hr") return { Icon: Users, className: "text-violet-600 dark:text-violet-400" };
  if (r === "manager") return { Icon: Briefcase, className: "text-emerald-600 dark:text-emerald-400" };
  return { Icon: UserRound, className: "text-slate-600 dark:text-slate-400" };
}

interface OrganizationRoleFieldProps {
  employee: Employee;
  isEditMode: boolean;
  viewerCanManage: boolean;
  value: AssignableOrgRole;
  onChange: (v: AssignableOrgRole) => void;
  isSaving?: boolean;
}

export function OrganizationRoleField({
  employee,
  isEditMode,
  viewerCanManage,
  value,
  onChange,
  isSaving = false,
}: OrganizationRoleFieldProps) {
  const { t } = useTranslation();
  const isTargetOwner =
    Boolean(employee.is_organization_owner) ||
    (employee.organization_role ?? "").trim().toLowerCase() === "owner";
  const currentLabel = employee.organization_role
    ? formatOrganizationRole(t, employee.organization_role)
    : t("layout.orgSwitcher.role.employee");
  const { Icon, className: iconClass } = roleIcon(
    isTargetOwner ? "owner" : employee.organization_role ?? "employee",
  );

  if (!employee.user_id) {
    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium">{t("employees.orgRole.fieldLabel", "Organization role")}</Label>
        <p className="text-sm text-muted-foreground">
          {t("employees.orgRole.noLinkedAuthUser", "No login account linked to this employee.")}
        </p>
      </div>
    );
  }

  if (isTargetOwner) {
    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium">{t("employees.orgRole.fieldLabel", "Organization role")}</Label>
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
          <Icon className={cn("h-4 w-4 shrink-0", iconClass)} aria-hidden />
          <span className="text-sm font-medium text-foreground">{currentLabel}</span>
          <Badge variant="secondary" className="ml-auto text-xs">
            {t("employees.orgRole.ownerReadOnly", "Owner — cannot change here")}
          </Badge>
        </div>
      </div>
    );
  }

  const showEditor = viewerCanManage && isEditMode;

  if (!showEditor) {
    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium">{t("employees.orgRole.fieldLabel", "Organization role")}</Label>
        <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
          <Icon className={cn("h-4 w-4 shrink-0", iconClass)} aria-hidden />
          <span className="text-sm text-foreground">{currentLabel}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="organization_role" className="text-sm font-medium">
        {t("employees.orgRole.fieldLabel", "Organization role")}
        <span className="text-red-500"> *</span>
      </Label>
      <Select
        value={value}
        onValueChange={(v) => onChange(v as AssignableOrgRole)}
        disabled={isSaving}
      >
        <SelectTrigger id="organization_role" className="border-gray-300">
          <SelectValue placeholder={t("employees.orgRole.placeholder", "Select role")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="employee">{formatOrganizationRole(t, "employee")}</SelectItem>
          <SelectItem value="admin">{formatOrganizationRole(t, "admin")}</SelectItem>
        </SelectContent>
      </Select>
      {["hr", "manager", "member"].includes((employee.organization_role ?? "").trim().toLowerCase()) ? (
        <p className="text-xs text-muted-foreground">
          {t(
            "employees.orgRole.detailRoleHint",
            "Current access includes “{{role}}”. Saving applies Admin or Employee only.",
            { role: currentLabel },
          )}
        </p>
      ) : null}
    </div>
  );
}
