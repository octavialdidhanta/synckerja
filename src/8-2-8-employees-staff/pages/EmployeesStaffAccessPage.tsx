import { useState } from "react";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { useDebouncedReady } from "@/shared/hooks/useDebouncedReady";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { EmployeesStaffModuleShell } from "../layout/EmployeesStaffModuleShell";
import { EmployeesStaffWorkspace } from "../layout/EmployeesStaffWorkspace";
import {
  useEnsurePosDefaultRoles,
  usePosEmployeeRoles,
  type PosEmployeeRoleRow,
} from "../hooks/usePosEmployeeRoles";
import { EmployeeAccessRolesTable } from "../components/access/EmployeeAccessRolesTable";
import { CreateEmployeeRoleSheet } from "../components/access/CreateEmployeeRoleSheet";

export default function EmployeesStaffAccessPage() {
  const { t } = useAppTranslation();
  const { orgBootstrapPending } = useOrgBootstrapPending();
  const { roles, isLoading, isError, error, refetch } = usePosEmployeeRoles();
  const [selected, setSelected] = useState<PosEmployeeRoleRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const showContent = useDebouncedReady(!(orgBootstrapPending || isLoading), 200);
  useEnsurePosDefaultRoles(showContent && !isLoading);

  return (
    <EmployeesStaffModuleShell showContent={showContent}>
      <EmployeesStaffWorkspace count={roles.length}>
          <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
            <h2 className="text-base font-semibold">
              {t("employeesStaff.access.title", "Employee Access")}
            </h2>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setSelected(null);
                setSheetOpen(true);
              }}
            >
              {t("employeesStaff.access.createRole", "Create Employee Role")}
            </Button>
          </div>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col p-4">
            {isError ? (
              <Alert variant="destructive" className="mb-3">
                <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {error instanceof Error
                      ? error.message
                      : t("employeesStaff.access.loadError", "Failed to load roles.")}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => void refetch()}>
                    {t("common.retry", "Retry")}
                  </Button>
                </AlertDescription>
              </Alert>
            ) : null}
            <EmployeeAccessRolesTable
              roles={roles}
              onSelect={(role) => {
                setSelected(role);
                setSheetOpen(true);
              }}
            />
          </div>
      </EmployeesStaffWorkspace>

      <CreateEmployeeRoleSheet
        open={sheetOpen}
        role={selected}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) setSelected(null);
        }}
      />
    </EmployeesStaffModuleShell>
  );
}
