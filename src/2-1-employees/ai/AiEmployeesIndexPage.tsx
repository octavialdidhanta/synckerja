import { useMemo } from "react";
import { useCentralizedUserData } from "@/shared/auth/contexts/useCentralizedUserData";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useEmployees } from "../hooks/useEmployees";
import { AiEmployeesIndexSkeleton } from "./AiEmployeesIndexSkeleton";
import { groupAiEmployeesByDepartment, OfficeWorkspace } from "./office/OfficeWorkspace";

function canOpenIndex(role?: string | null): boolean {
  const value = (role ?? "").trim().toLowerCase();
  return value === "owner" || value === "admin";
}

export default function AiEmployeesIndexPage() {
  const { t } = useAppTranslation();
  const { userRole, loading: userLoading } = useCentralizedUserData();
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const employeesQuery = useEmployees();
  const allowed = canOpenIndex(userRole);
  const pending = orgLoading || userLoading || (Boolean(organizationId) && employeesQuery.isLoading);
  const unassignedLabel = t("aiEmployee.index.unassigned", "Umum");
  const noRoleLabel = t("aiEmployee.index.noRole", "Belum ada jabatan");
  const aiEmployees = useMemo(
    () => (employeesQuery.data ?? []).filter((employee) => employee.is_ai),
    [employeesQuery.data],
  );
  const bays = useMemo(
    () => groupAiEmployeesByDepartment(aiEmployees, unassignedLabel),
    [aiEmployees, unassignedLabel],
  );

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-gray-100 font-sans">
      {pending ? (
        <AiEmployeesIndexSkeleton />
      ) : (
        <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col px-4 pb-2">
          <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
            <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex h-full min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex min-h-full flex-col">
                <div className="mb-1 flex-shrink-0 px-1 py-3">
                  <h1 className="text-lg font-semibold text-gray-900">
                    {t("layout.nav.aiEmployees", "Karyawan AI")}
                  </h1>
                  <p className="text-xs text-gray-500">
                    {t("aiEmployee.index.subtitle", "Pilih karyawan AI untuk melihat kerja, brief, dan jadwal.")}
                  </p>
                </div>
                <div className="grid min-h-[calc(100vh-120px)] w-full min-w-0 flex-1 grid-cols-12 items-start gap-2">
                  <div className="col-span-12 flex min-w-0 flex-col gap-2">
                    {!allowed ? (
                      <div className="rounded-md border border-border bg-card p-4 text-sm text-gray-700">
                        {t("aiEmployee.page.forbidden", "Halaman ini hanya untuk owner dan admin organisasi ini.")}
                      </div>
                    ) : employeesQuery.isError ? (
                      <div className="rounded-md border border-border bg-card p-4 text-sm text-gray-700">
                        {t("aiEmployee.index.loadError", "Daftar karyawan AI gagal dimuat.")}
                      </div>
                    ) : aiEmployees.length === 0 ? (
                      <div className="rounded-md border border-[#e4d5c0] bg-[#fffaf3] p-4 text-sm text-[#3f3428]">
                        {t("aiEmployee.index.empty", "Belum ada karyawan AI.")}
                      </div>
                    ) : (
                      <OfficeWorkspace bays={bays} noRoleLabel={noRoleLabel} />
                    )}
                  </div>
                </div>
                <div className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4" aria-hidden />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
