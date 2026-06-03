import React, { useState, useMemo, useCallback } from "react";
import { HeaderAndTab } from "@/2-1-employees/section/HeaderAndTab";
import { ModuleShellContentGate } from "@/shared/layouts/ModuleShellContentGate";
import { useCurrentOrg } from "@/1-home/components/HomeOKRDashboard/hooks/useCurrentOrg";
import { cn } from "@/shared/lib/utils";
import { useEmployees } from "../hooks/useEmployees";
import { useReprimands } from "../hooks/useReprimands";
import ReprimandManagementFilters from "../components/ReprimandManagementFilters";
import ReprimandManagementMetricsCards from "../components/ReprimandManagementMetricsCards";
import { ReprimandManagementTable } from "../components/ReprimandManagementTable";
import ReprimandManagementOverview from "../components/ReprimandManagementOverview";
import { ReprimandManagementPageSkeleton } from "../components/ReprimandManagementPageSkeleton";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

interface ReprimandCount {
  [employeeId: string]: number;
}

interface ReprimandFilters {
  search: string;
  department: string;
  status: string;
  severity: string;
  type: string;
  timePeriod: string;
}

export const ReprimandManagementPage = () => {
  const [activeTab, setActiveTab] = useState("reprimand");
  const { t } = useAppTranslation();
  const { loading: orgLoading } = useCurrentOrg();

  const {
    employees,
    isPending: employeesPending,
    error: employeesError,
    refetch: refetchEmployees,
  } = useEmployees();
  const {
    reprimands,
    isPending: reprimandsPending,
    error: reprimandsError,
    refetch: refetchReprimands,
  } = useReprimands();

  const [filters, setFilters] = useState<ReprimandFilters>({
    search: "",
    department: "all",
    status: "all",
    severity: "all",
    type: "all",
    timePeriod: "all",
  });

  const updateFilter = (key: keyof ReprimandFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      search: "",
      department: "all",
      status: "all",
      severity: "all",
      type: "all",
      timePeriod: "all",
    });
  };

  const filteredReprimands = useMemo(() => {
    return reprimands.filter((reprimand) => {
      if (filters.search) {
        const employee = employees.find((e) => e.id === reprimand.employee_id);
        const searchLower = filters.search.toLowerCase();
        const nameMatch = (employee?.full_name ?? "").toLowerCase().includes(searchLower);
        const descMatch = (reprimand.violation_description ?? "").toLowerCase().includes(searchLower);
        if (!nameMatch && !descMatch) return false;
      }

      if (filters.status !== "all" && reprimand.status !== filters.status) {
        return false;
      }

      if (filters.severity !== "all" && reprimand.severity_level !== filters.severity) {
        return false;
      }

      if (filters.type !== "all" && reprimand.reprimand_type !== filters.type) {
        return false;
      }

      if (filters.timePeriod !== "all") {
        const raw = reprimand.created_at || reprimand.incident_date;
        if (raw == null || raw === "") return false;
        const reprimandDate = new Date(raw);
        if (Number.isNaN(reprimandDate.getTime())) return false;
        const now = new Date();
        const daysDiff = Math.floor((now.getTime() - reprimandDate.getTime()) / (1000 * 60 * 60 * 24));

        switch (filters.timePeriod) {
          case "this_week":
            if (daysDiff > 7) return false;
            break;
          case "this_month":
            if (daysDiff > 30) return false;
            break;
          case "last_month":
            if (daysDiff < 30 || daysDiff > 60) return false;
            break;
          case "last_3_months":
            if (daysDiff > 90) return false;
            break;
          case "last_6_months":
            if (daysDiff > 180) return false;
            break;
          case "this_year":
            if (reprimandDate.getFullYear() !== now.getFullYear()) return false;
            break;
          case "last_year":
            if (reprimandDate.getFullYear() !== now.getFullYear() - 1) return false;
            break;
        }
      }

      return true;
    });
  }, [reprimands, filters, employees]);

  const reprimandCounts: ReprimandCount = reprimands.reduce((acc, reprimand) => {
    const employeeId = reprimand.employee_id;
    acc[employeeId] = (acc[employeeId] || 0) + 1;
    return acc;
  }, {} as ReprimandCount);

  const filteredEmployees = employees.filter((employee) => {
    if (filters.department !== "all") {
      const dept = employee.departments?.name || "Unassigned";
      if (dept !== filters.department) {
        return false;
      }
    }
    return true;
  });

  const employeesByDepartment = filteredEmployees.reduce(
    (acc, employee) => {
      const dept = employee.departments?.name || "Unassigned";
      if (!acc[dept]) {
        acc[dept] = [];
      }
      acc[dept].push(employee);
      return acc;
    },
    {} as Record<string, (typeof filteredEmployees)[number][]>,
  );

  const departments = [...new Set(employees.map((e) => e.departments?.name || "Unassigned"))].sort();

  const getFilterOptions = () => {
    const statuses = [...new Set(reprimands.map((r) => r.status))].filter(Boolean) as string[];
    const severities = [...new Set(reprimands.map((r) => r.severity_level))].filter(Boolean) as string[];
    const types = [...new Set(reprimands.map((r) => r.reprimand_type))].filter(Boolean) as string[];

    return {
      departments: departments as string[],
      statuses,
      severities,
      types,
    };
  };

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
  }, []);

  const getReprimandCount = (employeeId: string) => {
    return reprimandCounts[employeeId] || 0;
  };

  const renderReprimandBoxes = useCallback(
    (count: number) => {
      const boxes = [];
      const maxBoxes = 5;

      const getBoxColor = (index: number, totalCount: number) => {
        if (index >= totalCount) {
          return "border-border bg-muted";
        }
        if (totalCount >= 4) {
          return "bg-red-600 border-red-700 shadow-md";
        }
        if (totalCount >= 3) {
          return "bg-orange-500 border-orange-600 shadow-sm";
        }
        if (totalCount >= 1) {
          return "bg-yellow-500 border-yellow-600 shadow-sm";
        }
        return "border-border bg-muted";
      };

      for (let i = 0; i < maxBoxes; i++) {
        const title =
          i < count
            ? t("reprimands.boxes.reprimandN", "Reprimand {{n}}", { n: i + 1 })
            : count > maxBoxes
              ? t("reprimands.boxes.showingMax", "Showing {{max}} of {{total}}", {
                  max: maxBoxes,
                  total: count,
                })
              : t("reprimands.boxes.none", "No reprimand");
        boxes.push(
          <div
            key={i}
            className={`h-6 w-6 rounded border transition-colors duration-200 ${getBoxColor(i, count)}`}
            title={title}
          />,
        );
      }

      return boxes;
    },
    [t],
  );

  const hasError = employeesError || reprimandsError;
  const dataPending = employeesPending || reprimandsPending;
  const showFullPageSkeleton = orgLoading || dataPending;

  if (hasError && !orgLoading && !dataPending) {
    return (
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-muted/40 font-sans">
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-8">
          <div className="max-w-md text-center">
            <p className="mb-2 font-medium text-destructive">{t("reprimands.error.title", "Failed to load data")}</p>
            <p className="mb-4 text-sm text-muted-foreground">
              {employeesError && reprimandsError
                ? t("reprimands.error.both", "Employee and reprimand data could not be loaded.")
                : employeesError
                  ? t("reprimands.error.employees", "Employee data could not be loaded.")
                  : t("reprimands.error.reprimands", "Reprimand data could not be loaded.")}
            </p>
            <button
              type="button"
              onClick={() => {
                if (employeesError) void refetchEmployees();
                if (reprimandsError) void refetchReprimands();
              }}
              className="rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue/90"
            >
              {t("reprimands.error.retry", "Try again")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-gray-100 font-sans">
      <div
        className={cn(
          "flex min-h-0 min-w-0 w-full flex-1",
          showFullPageSkeleton && "pointer-events-none invisible",
        )}
      >
        <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col bg-muted/40 px-4 pb-2">
          <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
            <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div className="flex min-h-full flex-col">
                <div className="mb-1 flex-shrink-0">
                  <HeaderAndTab activeTab={activeTab} onTabChange={handleTabChange} />
                </div>

                <ModuleShellContentGate pagePath="/employees/reprimand">
                <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
                  <div className="col-span-9 flex h-full min-h-0 min-w-0 flex-col self-stretch overflow-hidden">
                    <div className="flex h-full min-h-0 min-w-0 flex-col">
                      <div className="mb-2 flex-shrink-0">
                        <div className="rounded-md border border-border bg-card p-2">
                          <ReprimandManagementFilters
                            filters={filters}
                            updateFilter={updateFilter}
                            getFilterOptions={getFilterOptions}
                            clearFilters={clearFilters}
                          />
                        </div>
                      </div>

                      <div className="mb-2 flex-shrink-0">
                        <ReprimandManagementMetricsCards reprimands={filteredReprimands} employees={filteredEmployees} />
                      </div>

                      <div className="flex min-h-[560px] min-w-0 flex-1 flex-col [@media(max-height:900px)]:min-h-[620px] [@media(max-height:760px)]:min-h-[680px]">
                        <div className="flex h-full min-h-0 min-w-0 flex-col rounded-lg border border-border bg-card shadow-sm">
                          <ReprimandManagementTable
                            employeesByDepartment={employeesByDepartment}
                            reprimands={filteredReprimands}
                            selectedDepartment={filters.department}
                            getReprimandCount={getReprimandCount}
                            renderReprimandBoxes={renderReprimandBoxes}
                            totalEmployees={filteredEmployees.length}
                            totalReprimands={filteredReprimands.length}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="col-span-3 flex h-full min-h-0 min-w-0 flex-col self-stretch">
                    <div className="flex h-full min-h-0 min-w-0 flex-col">
                      <ReprimandManagementOverview reprimands={filteredReprimands} employees={filteredEmployees} />
                    </div>
                  </div>
                </div>
                </ModuleShellContentGate>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showFullPageSkeleton ? (
        <div className="absolute inset-0 z-10 overflow-hidden">
          <ReprimandManagementPageSkeleton />
        </div>
      ) : null}
    </div>
  );
};

