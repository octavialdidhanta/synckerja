import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useActiveOrganization } from "@/10-subscription/shared/useActiveOrganization";

export interface EmployeeGrowthData {
  month: string;
  count: number;
  date: string;
}

export interface FeatureUsageData {
  feature: string;
  usage: number;
  total_access: number;
  unique_users: number;
}

export interface SubscriptionAnalytics {
  employee_growth: EmployeeGrowthData[];
  feature_usage: FeatureUsageData[];
  usage_metrics: {
    employee_utilization_percentage: number;
    plan_efficiency_score: number;
    growth_rate: number;
  };
}

export function useSubscriptionAnalytics() {
  const { organizationId } = useActiveOrganization();

  const { data: analytics, isLoading, error, refetch, isError } = useQuery({
    queryKey: ["subscription-analytics", organizationId],
    queryFn: async () => {
      if (!organizationId) throw new Error("No organization ID");

      const since6m = new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: employeeGrowth, error: employeeError } = await supabase
        .from("employees")
        .select("created_at")
        .eq("organization_id", organizationId)
        .gte("created_at", since6m)
        .order("created_at", { ascending: true });

      if (employeeError) throw employeeError;

      const growthByMonth = (employeeGrowth || []).reduce(
        (acc, emp: { created_at: string }) => {
          const monthKey = new Date(emp.created_at).toLocaleDateString("en-US", {
            month: "short",
            year: "numeric",
          });
          acc[monthKey] = (acc[monthKey] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      const employee_growth: EmployeeGrowthData[] = Object.entries(growthByMonth).map(([month, count]) => ({
        month: month.split(" ")[0],
        count,
        date: month,
      }));

      const { data: employeeRows, error: employeeCountError } = await supabase
        .from("employees")
        .select("id, employee_status_id, pending_removal")
        .eq("organization_id", organizationId);
      if (employeeCountError) throw employeeCountError;

      const statusIds = Array.from(
        new Set((employeeRows ?? []).map((e: { employee_status_id?: string }) => e.employee_status_id).filter(Boolean)),
      ) as string[];
      let activeStatusIds = new Set<string>();
      if (statusIds.length > 0) {
        const { data: statusRows } = await supabase
          .from("employee_statuses")
          .select("id, name")
          .in("id", statusIds);
        activeStatusIds = new Set(
          (statusRows ?? [])
            .filter((s: { name?: string }) => ["active", "probation"].includes(String(s.name || "").toLowerCase()))
            .map((s: { id: string }) => s.id),
        );
      }
      const employeeCount = (employeeRows ?? []).filter((e: { pending_removal?: boolean; employee_status_id?: string }) => {
        if (e.pending_removal === true) return false;
        if (!e.employee_status_id) return true;
        return activeStatusIds.has(e.employee_status_id);
      }).length;

      const { data: activityData, error: activityError } = await supabase
        .from("activities")
        .select("activity_type, user_id")
        .eq("organization_id", organizationId)
        .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      if (activityError) throw activityError;

      type ActivityRow = { activity_type?: string | null; user_id?: string | null };
      const rows = (activityData ?? []) as ActivityRow[];

      const formatActivityTypeLabel = (raw: string) =>
        raw.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

      const byType = new Map<string, { count: number; userIds: Set<string> }>();
      for (const row of rows) {
        const type = String(row.activity_type ?? "unknown").trim() || "unknown";
        const uid = row.user_id;
        let agg = byType.get(type);
        if (!agg) {
          agg = { count: 0, userIds: new Set<string>() };
          byType.set(type, agg);
        }
        agg.count += 1;
        if (uid) agg.userIds.add(uid);
      }

      /** Real counts from `public.activities` (RLS-scoped); no synthetic filler. */
      let feature_usage: FeatureUsageData[] = Array.from(byType.entries()).map(([type, agg]) => ({
        feature: formatActivityTypeLabel(type),
        usage: agg.count,
        total_access: agg.count,
        unique_users: agg.userIds.size,
      }));

      feature_usage.sort((a, b) => b.usage - a.usage);
      feature_usage = feature_usage.slice(0, 10);

      const employeeUtilizationPercentage = employeeCount ? Math.min(100, (employeeCount / 1000) * 100) : 0;
      const planEfficiencyScore = Math.min(100, employeeUtilizationPercentage * 1.2);
      const firstCount = employee_growth.length > 0 ? employee_growth[0].count : 0;
      const growthRate =
        employee_growth.length > 1 && firstCount !== 0
          ? ((employee_growth[employee_growth.length - 1].count - firstCount) / firstCount) * 100
          : 0;

      const result: SubscriptionAnalytics = {
        employee_growth,
        feature_usage,
        usage_metrics: {
          employee_utilization_percentage: employeeUtilizationPercentage,
          plan_efficiency_score: planEfficiencyScore,
          growth_rate: growthRate,
        },
      };
      return result;
    },
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  return { analytics, isLoading, error, refetch, isError };
}
