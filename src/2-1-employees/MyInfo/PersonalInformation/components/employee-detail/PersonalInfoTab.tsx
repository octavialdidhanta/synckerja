
import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/shared/components/ui/card";
import { useCentralizedUserData } from "@/shared/auth/contexts/CentralizedUserDataContext";
import { useUpdateEmployee } from "../../hooks";
import { PersonalInfoForm } from "./PersonalInfoForm";
import {
  OrganizationRoleField,
  assignableOrgRoleSelectValue,
} from "./OrganizationRoleField";
import { canManageEmployees } from "@/2-1-employees/hooks/roles";
import type { AssignableOrgRole } from "@/2-1-employees/hooks/useUpdateEmployeeOrganizationRole";
import { useUpdateEmployeeOrganizationRole } from "@/2-1-employees/hooks/useUpdateEmployeeOrganizationRole";
import type { Employee } from "@/shared/hooks/employees/useEmployees";
import { toast } from "sonner";

function getUpdateErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message: unknown }).message;
    if (typeof m === "string" && m.trim()) return m;
  }
  return fallback;
}

interface PersonalInfoTabProps {
  employee: Employee;
  isEditMode: boolean;
  onUpdate: () => void;
}

export const PersonalInfoTab = ({ employee, isEditMode, onUpdate }: PersonalInfoTabProps) => {
  const updateEmployee = useUpdateEmployee();
  const updateOrgRole = useUpdateEmployeeOrganizationRole();
  const { userRole } = useCentralizedUserData();
  const viewerCanManage = canManageEmployees(userRole ?? undefined);

  const [roleDraft, setRoleDraft] = useState<AssignableOrgRole>("employee");
  const roleSnapshotRef = useRef<string | null>(null);
  const prevIsEditRef = useRef(false);

  useEffect(() => {
    const entering = isEditMode && !prevIsEditRef.current;
    prevIsEditRef.current = isEditMode;
    if (entering) {
      roleSnapshotRef.current = employee.organization_role ?? null;
      setRoleDraft(assignableOrgRoleSelectValue(roleSnapshotRef.current));
    }
  }, [isEditMode, employee.id, employee.organization_role]);

  const handleSave = async (formData: Record<string, unknown>): Promise<boolean> => {
    if (!employee?.id) return false;

    const updatePayload = {
      full_name: formData.full_name,
      email: formData.email,
      mobile_phone: formData.mobile_phone,
      birth_date: formData.birth_date,
      birth_place: formData.birth_place,
      gender: formData.gender,
      nik: formData.nik,
      religion: formData.religion,
      marital_status: formData.marital_status,
      updated_at: new Date().toISOString(),
    };

    const isTargetOwner =
      Boolean(employee.is_organization_owner) ||
      (employee.organization_role ?? "").trim().toLowerCase() === "owner";

    const beforeAssignable = assignableOrgRoleSelectValue(roleSnapshotRef.current);
    const wantsRoleChange =
      viewerCanManage &&
      !isTargetOwner &&
      Boolean(employee.user_id && employee.organization_id) &&
      roleDraft !== beforeAssignable;

    try {
      if (wantsRoleChange && employee.user_id && employee.organization_id) {
        try {
          await updateOrgRole.mutateAsync({
            employeeUserId: employee.user_id,
            organizationId: employee.organization_id,
            employeeRecordId: employee.id,
            newRole: roleDraft,
          });
        } catch (roleErr) {
          console.error("Organization role update failed:", roleErr);
          toast.error(
            getUpdateErrorMessage(
              roleErr,
              "Organization role could not be updated. Check database permissions (RLS) or try again.",
            ),
          );
          return false;
        }
      }

      await updateEmployee.mutateAsync({
        id: employee.id,
        data: updatePayload,
      });

      onUpdate();
      return true;
    } catch (error) {
      console.error("Error updating personal info:", error);
      return false;
    }
  };

  if (typeof window !== "undefined") {
    (window as unknown as { savePersonalInfo?: () => Promise<boolean> }).savePersonalInfo =
      async () => {
        const formData = (window as unknown as { personalInfoFormData?: Record<string, unknown> })
          .personalInfoFormData;
        if (formData) {
          return await handleSave(formData);
        }
        return false;
      };
  }

  const roleSaving = updateOrgRole.isPending;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <PersonalInfoForm
            employee={employee}
            isEditMode={isEditMode}
            onSave={handleSave}
            isLoading={updateEmployee.isPending || roleSaving}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">
            Organization access
          </h3>
          <OrganizationRoleField
            employee={employee}
            isEditMode={isEditMode}
            viewerCanManage={viewerCanManage}
            value={roleDraft}
            onChange={setRoleDraft}
            isSaving={roleSaving}
          />
        </CardContent>
      </Card>
    </div>
  );
};
