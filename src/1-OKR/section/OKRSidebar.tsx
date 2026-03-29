import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { enUS, id as idLocale } from "date-fns/locale";
import { CheckCircle, Clock, Target, TrendingUp } from "lucide-react";
import { isEmployeeActive } from "@/2-1-employees/utils/employeeUtils";
import { supabase } from "@/shared/lib/supabaseClient";
import { logger } from "@/shared/lib/logger";
import { cn } from "@/shared/lib/utils";
import { filterValidCycleIds } from "@/shared/lib/uuidValidation";

interface OKRSidebarProps {
  activeTab: string;
  organizationId?: string;
  companyStats?: {
    avgProgress: number;
    totalObjectives: number;
    nextDeadline: string;
    active?: number;
    draft?: number;
    completed?: number;
  };
  departmentStats?: {
    avgProgress: number;
    totalObjectives: number;
    nextDeadline: string;
    active?: number;
    draft?: number;
    completed?: number;
  };
  individualStats?: {
    avgProgress: number;
    totalObjectives: number;
    nextDeadline: string;
    active?: number;
    draft?: number;
    completed?: number;
  };
  cycleIds?: string[];
  /** Fired when recent check-ins or top performers queries are pending (OKR page skeleton gate). */
  onSidebarQueriesLoadingChange?: (loading: boolean) => void;
}

export function OKRSidebar({
  activeTab,
  organizationId,
  companyStats,
  departmentStats,
  individualStats,
  cycleIds,
  onSidebarQueriesLoadingChange,
}: OKRSidebarProps) {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language.startsWith("id") ? idLocale : enUS;

  const getStatusNameFromJoin = (row: {
    employee_statuses?: { name?: string } | { name?: string }[] | null;
  }) => {
    const es = row.employee_statuses;
    if (!es) return null;
    if (Array.isArray(es)) return es[0]?.name ?? null;
    return es.name ?? null;
  };

  const currentStats = useMemo(() => {
    if (activeTab === "department-objectives") return departmentStats;
    if (activeTab === "individual-objectives") return individualStats;
    return companyStats;
  }, [activeTab, companyStats, departmentStats, individualStats]);

  const { data: recentCheckins = [], isPending: recentCheckinsPending } = useQuery({
    queryKey: ["recent-checkins-okr", organizationId, cycleIds],
    queryFn: async () => {
      if (!organizationId) return [];

      // Schema (see supabase/migrations/20260430210000_1-home_dashboard_reference_schema.sql):
      // weekly_checkins has individual_objective_id → individual_objectives, not key_result_id → key_results.
      // Reference OKR embed used key_results!weekly_checkins_key_result_id_fkey which PostgREST rejects here (PGRST200).
      const query = supabase
        .from("weekly_checkins")
        .select(
          `
          id,
          week_start,
          notes,
          created_at,
          employees!weekly_checkins_employee_id_fkey (
            full_name,
            employee_status_id,
            pending_removal,
            employee_statuses!left(name)
          ),
          individual_objectives!weekly_checkins_individual_objective_id_fkey (
            title
          )
        `,
        )
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(5);

      const { data, error } = await query;

      if (error) {
        logger.error("OKRSidebar: recent check-ins", error);
        return [];
      }

      const filteredCheckins = (data || []).filter((checkin: { employees?: unknown }) => {
        const employee = checkin.employees as
          | {
              pending_removal?: boolean | null;
              employee_statuses?: { name?: string } | { name?: string }[] | null;
            }
          | undefined;
        if (!employee) return true;
        return isEmployeeActive({
          employee_status_name: getStatusNameFromJoin(employee),
          status: null,
          pending_removal: employee.pending_removal,
        });
      });

      return filteredCheckins;
    },
    enabled: !!organizationId,
    staleTime: 1000 * 60 * 5,
  });

  const { data: topPerformers = [], isPending: topPerformersPending } = useQuery({
    queryKey: ["top-performers-okr", organizationId, activeTab, cycleIds],
    queryFn: async () => {
      if (!organizationId) return [];

      if (activeTab === "department-objectives") {
        let query = supabase
          .from("department_objectives")
          .select("department_id, progress_percentage, departments!department_objectives_department_id_fkey(name)")
          .eq("organization_id", organizationId);

        const validCycleIds = filterValidCycleIds(cycleIds);
        if (validCycleIds.length > 0) {
          query = query.in("cycle_id", validCycleIds);
        }

        const { data: deptObjectives, error } = await query;

        if (error || !deptObjectives) return [];

        const deptProgress: Record<string, { name: string; progress: number; count: number }> = {};
        deptObjectives.forEach((obj) => {
          const deptId = obj.department_id;
          if (!deptId) return;

          const deptName =
            (obj.departments as { name?: string } | null)?.name ?? t("layout.okr.sidebar.unknownDepartment");
          if (!deptProgress[deptId]) {
            deptProgress[deptId] = { name: deptName, progress: 0, count: 0 };
          }
          deptProgress[deptId].progress += obj.progress_percentage || 0;
          deptProgress[deptId].count += 1;
        });

        return Object.values(deptProgress)
          .map((dept) => ({
            id: dept.name,
            name: dept.name,
            progress: Math.round(dept.progress / dept.count),
            type: "department" as const,
          }))
          .sort((a, b) => b.progress - a.progress)
          .slice(0, 5);
      }

      if (activeTab === "individual-objectives") {
        let query = supabase
          .from("individual_objectives")
          .select(
            `
            employee_id,
            progress_percentage,
            employees!individual_objectives_employee_id_fkey(
              full_name,
              employee_status_id,
              pending_removal,
              employee_statuses!left(name)
            )
          `,
          )
          .eq("organization_id", organizationId);

        const validCycleIds = filterValidCycleIds(cycleIds);
        if (validCycleIds.length > 0) {
          query = query.in("cycle_id", validCycleIds);
        }

        const { data: indivObjectives, error } = await query;

        if (error || !indivObjectives) return [];

        const empProgress: Record<string, { name: string; progress: number; count: number }> = {};
        indivObjectives.forEach((obj) => {
          const empId = obj.employee_id;
          if (!empId) return;

          const employee = obj.employees as {
            full_name?: string;
            pending_removal?: boolean | null;
            employee_statuses?: { name?: string } | { name?: string }[] | null;
          } | null;
          const empName = employee?.full_name ?? t("layout.okr.sidebar.unknownEmployee");

          if (
            !isEmployeeActive({
              employee_status_name: getStatusNameFromJoin(employee || {}),
              status: null,
              pending_removal: employee?.pending_removal,
            })
          ) {
            return;
          }

          if (!empProgress[empId]) {
            empProgress[empId] = { name: empName, progress: 0, count: 0 };
          }
          empProgress[empId].progress += obj.progress_percentage || 0;
          empProgress[empId].count += 1;
        });

        return Object.values(empProgress)
          .map((emp) => ({
            id: emp.name,
            name: emp.name,
            progress: Math.round(emp.progress / emp.count),
            type: "individual" as const,
          }))
          .sort((a, b) => b.progress - a.progress)
          .slice(0, 5);
      }

      return [];
    },
    enabled: !!organizationId && (activeTab === "department-objectives" || activeTab === "individual-objectives"),
    staleTime: 1000 * 60 * 5,
  });

  const sidebarQueriesLoading = useMemo(() => {
    if (!organizationId) return false;
    if (activeTab === "company-objectives") return recentCheckinsPending;
    return recentCheckinsPending || topPerformersPending;
  }, [
    organizationId,
    activeTab,
    recentCheckinsPending,
    topPerformersPending,
  ]);

  useEffect(() => {
    onSidebarQueriesLoadingChange?.(sidebarQueriesLoading);
  }, [onSidebarQueriesLoadingChange, sidebarQueriesLoading]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3">
        <div className="rounded-lg bg-brand-blue-soft p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-brand-blue-on-soft">{t("layout.okr.sidebar.totalObjectives")}</p>
              <p className="text-lg font-bold text-brand-blue">{currentStats?.totalObjectives || 0}</p>
            </div>
            <Target className="h-4 w-4 shrink-0 text-brand-blue" />
          </div>
        </div>

        <div className="rounded-lg bg-emerald-50 p-3 dark:bg-emerald-950/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-emerald-800 dark:text-emerald-200">{t("layout.okr.sidebar.active")}</p>
              <p className="text-lg font-bold text-emerald-900 dark:text-emerald-100">{currentStats?.active || 0}</p>
            </div>
            <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          </div>
        </div>

        <div className="rounded-lg bg-surface-muted p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">{t("layout.okr.sidebar.completed")}</p>
              <p className="text-lg font-bold text-foreground">{currentStats?.completed || 0}</p>
            </div>
            <TrendingUp className="h-4 w-4 shrink-0 text-muted-foreground" />
          </div>
        </div>

        <div className="rounded-lg bg-surface-subtle p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">{t("layout.okr.sidebar.avgProgress")}</p>
              <p className="text-lg font-bold text-foreground">{currentStats?.avgProgress || 0}%</p>
            </div>
            <TrendingUp className="h-4 w-4 shrink-0 text-brand-blue" />
          </div>
        </div>
      </div>

      {topPerformers.length > 0 && (
        <div>
          <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold text-foreground">
            <TrendingUp className="h-3 w-3 shrink-0" />
            {t("layout.okr.sidebar.topPerformers")}
          </h4>
          <div className="space-y-2">
            {topPerformers.map((performer, index) => (
              <div key={performer.id} className="rounded-lg bg-muted/50 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex min-w-0 items-center space-x-2">
                    <div className={rankBadgeClass(index)}>
                      {index + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{performer.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {performer.type === "department"
                          ? t("layout.okr.sidebar.typeDepartment")
                          : t("layout.okr.sidebar.typeIndividual")}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold text-foreground">{performer.progress}%</p>
                    <p className="text-xs text-muted-foreground">{t("layout.okr.sidebar.progress")}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold text-foreground">
          <Clock className="h-3 w-3 shrink-0" />
          {t("layout.okr.sidebar.recentActivity")}
        </h4>
        <div className="space-y-2">
          {recentCheckins.length > 0 ? (
            recentCheckins.map((checkin) => {
              const objective = checkin.individual_objectives as { title?: string | null } | null | undefined;
              const notesTrim = typeof checkin.notes === "string" ? checkin.notes.trim() : "";
              const subtitle =
                objective?.title?.trim() ||
                (notesTrim ? `${notesTrim.slice(0, 80)}${notesTrim.length > 80 ? "…" : ""}` : t("layout.okr.sidebar.checkIn"));
              return (
                <div key={checkin.id} className="rounded-lg bg-muted/50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-foreground">
                        {checkin.employees?.full_name ?? t("layout.okr.sidebar.unknownPerson")}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {checkin.created_at
                          ? format(new Date(checkin.created_at), "MMM dd, HH:mm", { locale: dateLocale })
                          : t("layout.okr.sidebar.notAvailable")}
                      </p>
                    </div>
                    <div
                      className="h-2 w-2 shrink-0 rounded-full bg-muted-foreground/70"
                      title={t("layout.okr.sidebar.checkIn")}
                    />
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-4 text-center text-xs text-muted-foreground">{t("layout.okr.sidebar.noRecentActivity")}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function rankBadgeClass(index: number): string {
  return cn(
    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
    index === 0 && "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
    index === 1 && "bg-muted text-muted-foreground",
    index === 2 && "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200",
    index > 2 && "bg-brand-blue-soft text-brand-blue",
  );
}
