import { useMemo, useState } from "react";
import { useCentralizedUserData } from "@/shared/auth/contexts/useCentralizedUserData";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useEmployees } from "../hooks/useEmployees";
import { AiEmployeesIndexSkeleton } from "./AiEmployeesIndexSkeleton";
import { HireAiEmployeeDialog } from "./HireAiEmployeeDialog";
import { groupAiEmployeesByDepartment, OfficeWorkspace } from "./office/OfficeWorkspace";
import { useAiEmployeeCatalogs } from "./useAiEmployeeCatalogs";
import { useAiEmployeeSeats } from "./useAiEmployeeSeats";

function canOpenIndex(role?: string | null): boolean {
  const value = (role ?? "").trim().toLowerCase();
  return value === "owner" || value === "admin";
}

export default function AiEmployeesIndexPage() {
  const { t } = useAppTranslation();
  const { userRole, loading: userLoading } = useCentralizedUserData();
  const { organizationId, loading: orgLoading } = useCurrentOrg();
  const employeesQuery = useEmployees();
  const seatsQuery = useAiEmployeeSeats(organizationId);
  const catalogsQuery = useAiEmployeeCatalogs(organizationId);
  const [hireOpen, setHireOpen] = useState(false);
  const allowed = canOpenIndex(userRole);
  const seatsFull = seatsQuery.isSuccess && seatsQuery.data.remaining < 1;
  const pending = orgLoading || userLoading || (Boolean(organizationId) && (employeesQuery.isLoading || catalogsQuery.isLoading));
  const unassignedLabel = t("aiEmployee.index.unassigned", "Umum");
  const noRoleLabel = t("aiEmployee.index.noRole", "Belum ada jabatan");
  const noCatalogLabel = t("aiEmployee.index.noCatalog", "Belum ada katalog");
  const catalogErrorLabel = t("aiEmployee.index.catalogError", "Katalog belum termuat");
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
                <div className="mb-1 flex flex-shrink-0 items-start justify-between gap-3 px-1 py-3">
                  <div className="min-w-0">
                    <h1 className="text-lg font-semibold text-gray-900">
                      {t("layout.nav.aiEmployees", "Karyawan AI")}
                    </h1>
                    <p className="text-xs text-gray-500">
                      {t("aiEmployee.index.subtitle", "Pilih karyawan AI untuk melihat kerja, brief, dan jadwal.")}
                    </p>
                  </div>
                  {allowed && organizationId ? (
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Button type="button" onClick={() => setHireOpen(true)}>
                        {t("aiEmployee.hire.open", "Rekrut karyawan AI")}
                      </Button>
                      {seatsQuery.isSuccess ? (
                        <p className="text-[11px] text-gray-500">
                          {seatsFull
                            ? t("aiEmployee.hire.full", "Kursi karyawan AI sudah penuh.")
                            : t("aiEmployee.hire.remaining", "{{count}} kursi tersisa", {
                                count: seatsQuery.data.remaining,
                              })}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
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
                      <OfficeWorkspace
                        bays={bays}
                        noRoleLabel={noRoleLabel}
                        catalogLabelFor={(employeeId) => {
                          if (catalogsQuery.isError) return catalogErrorLabel;
                          const catalogName = catalogsQuery.data?.get(employeeId);
                          return catalogName
                            ? t("aiEmployee.index.catalog", "Katalog · {{name}}", { name: catalogName })
                            : noCatalogLabel;
                        }}
                      />
                    )}
                  </div>
                </div>
                <div className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4" aria-hidden />
                {allowed && organizationId ? (
                  <HireAiEmployeeDialog
                    organizationId={organizationId}
                    open={hireOpen}
                    onOpenChange={setHireOpen}
                  />
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
