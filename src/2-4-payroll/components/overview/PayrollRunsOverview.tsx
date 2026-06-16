import { useState, type MouseEvent } from "react";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Play, Users, DollarSign, Loader2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCentralizedUserData } from "@/shared/auth/contexts/CentralizedUserDataContext";
import { toast } from "sonner";
import { isEmployeeEligibleForPayroll } from "@/2-1-employees/utils/employeeUtils";
import { cn } from "@/shared/lib/utils";
import { payrollCalculationsQueryKey } from "../../hooks/payrollCalculationsQueryKey";

interface PayrollRun {
  id: string;
  run_name: string;
  status: string;
  created_at: string;
  total_employees?: number;
  realtime_eligible_employees?: number;
  processed_employees_count?: number;
  ready_to_process_employees?: number;
  total_gross_pay?: number;
  total_net_pay?: number;
  total_deductions?: number;
  total_penalties?: number;
  total_taxes?: number;
  payroll_periods: {
    period_name: string;
  } | null;
}

interface PayrollProcessResult {
  success: boolean;
  message: string;
  calculations_created?: number;
}

interface PayrollRunsOverviewProps {
  selectedRunId?: string | null;
  onRunSelect?: (runId: string | null) => void;
  onRunBlocked?: (message: string | null) => void;
}

type PreflightIssue = {
  employeeName: string;
  employeeId: string;
  missing: string[];
};

export function PayrollRunsOverview({
  selectedRunId,
  onRunSelect,
  onRunBlocked,
}: PayrollRunsOverviewProps) {
  const { organization } = useCentralizedUserData();
  const organizationId = organization?.id ?? null;
  const queryClient = useQueryClient();
  const [processingRunId, setProcessingRunId] = useState<string | null>(null);

  const buildPayrollEligibilitySnapshot = async (): Promise<{
    eligibleEmployees: Array<{ id: string; full_name: string | null; employee_id: string | null }>;
    issues: PreflightIssue[];
  }> => {
    if (!organizationId) return { eligibleEmployees: [], issues: [] };

    const { data: employees, error: employeesError } = await supabase
      .from("employees")
      .select("id, employee_id, full_name, employee_status_id, pending_removal")
      .eq("organization_id", organizationId);

    if (employeesError) throw employeesError;

    const statusIds = Array.from(
      new Set((employees || []).map((emp) => emp.employee_status_id).filter(Boolean)),
    ) as string[];

    let statusNameById = new Map<string, string>();
    if (statusIds.length > 0) {
      const { data: statuses, error: statusesError } = await supabase
        .from("employee_statuses")
        .select("id, name")
        .in("id", statusIds);

      if (statusesError) throw statusesError;
      statusNameById = new Map((statuses || []).map((status) => [status.id, status.name]));
    }

    const normalizedEmployees = (employees || []).map((emp) => ({
      ...emp,
      employee_status_name: emp.employee_status_id
        ? statusNameById.get(emp.employee_status_id) || null
        : null,
    }));

    const eligibleEmployees = normalizedEmployees.filter((emp) => isEmployeeEligibleForPayroll(emp));

    if (eligibleEmployees.length === 0) return { eligibleEmployees: [], issues: [] };

    const eligibleIds = eligibleEmployees.map((emp) => emp.id);
    const { data: payrollInfo, error: payrollInfoError } = await supabase
      .from("employee_payroll_info")
      .select("employee_id, basic_salary, ptkp_status, tax_configuration_id")
      .in("employee_id", eligibleIds);

    if (payrollInfoError) throw payrollInfoError;

    const payrollInfoByEmployeeId = new Map((payrollInfo || []).map((info) => [info.employee_id, info]));

    const issues: PreflightIssue[] = [];
    for (const employee of eligibleEmployees) {
      const info = payrollInfoByEmployeeId.get(employee.id);
      const missing: string[] = [];

      if (!info) {
        missing.push("Payroll info");
      } else {
        if (!info.basic_salary || info.basic_salary <= 0) missing.push("Basic salary");
        if (!info.ptkp_status) missing.push("PTKP status");
        if (!info.tax_configuration_id) missing.push("Tax configuration");
      }

      if (missing.length > 0) {
        issues.push({
          employeeName: employee.full_name || "Unknown Employee",
          employeeId: employee.employee_id || "-",
          missing,
        });
      }
    }

    return { eligibleEmployees, issues };
  };

  const runPayrollPreflight = async (): Promise<{ ok: boolean; issues: PreflightIssue[] }> => {
    const snapshot = await buildPayrollEligibilitySnapshot();
    if (snapshot.eligibleEmployees.length === 0) {
      return {
        ok: false,
        issues: [
          {
            employeeName: "No eligible employees",
            employeeId: "-",
            missing: ["Employee status must be active or probation"],
          },
        ],
      };
    }
    return { ok: snapshot.issues.length === 0, issues: snapshot.issues };
  };

  const handleProcessPayroll = async (runId: string, event: MouseEvent) => {
    event.stopPropagation();

    try {
      setProcessingRunId(runId);
      toast.loading("Processing payroll calculations...", { id: "payroll-process" });

      const preflight = await runPayrollPreflight();
      if (!preflight.ok) {
        const detailLines = preflight.issues
          .slice(0, 8)
          .map((issue) => `${issue.employeeName} (${issue.employeeId}): ${issue.missing.join(", ")}`);
        const hasMore = preflight.issues.length > 8;
        const detailMessage = [
          "Run payroll diblokir: lengkapi payroll info dulu.",
          ...detailLines,
          hasMore ? `...dan ${preflight.issues.length - 8} employee lainnya` : "",
        ]
          .filter(Boolean)
          .join("\n");

        onRunBlocked?.(detailMessage);
        toast.error(`Run payroll diblokir. ${preflight.issues.length} employee masih belum lengkap.`, {
          id: "payroll-process",
        });
        return;
      }

      onRunBlocked?.(null);

      const { data: processResult, error: processError } = await supabase.rpc("process_payroll_run", {
        p_run_id: runId,
      });

      if (processError) throw processError;

      const result = processResult as unknown as PayrollProcessResult;
      if (result?.success) {
        toast.success(result.message || "Payroll calculations completed successfully!", {
          id: "payroll-process",
        });
      } else {
        throw new Error(result?.message || "Payroll processing failed");
      }

      queryClient.invalidateQueries({ queryKey: ["payroll-runs-overview"] });
      queryClient.invalidateQueries({ queryKey: ["payroll-calculations"] });
      queryClient.invalidateQueries({ queryKey: ["payroll-run-details"] });
    } catch (error: unknown) {
      let msg = error instanceof Error ? error.message : "Failed to process payroll calculations";
      if (msg.includes("function") && msg.includes("does not exist")) {
        msg =
          "RPC process_payroll_run belum ter-deploy. Jalankan migrasi payroll terbaru ke Supabase (supabase db push).";
      }
      toast.error(msg, { id: "payroll-process" });
    } finally {
      setProcessingRunId(null);
    }
  };

  const { data: runs, isLoading } = useQuery({
    queryKey: ["payroll-runs-overview", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from("payroll_runs")
        .select(
          `
          *,
          payroll_periods (
            period_name
          )
        `,
        )
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;

      const runIds = (data || []).map((run) => run.id);

      const snapshot = await buildPayrollEligibilitySnapshot();
      const realtimeEligibleEmployees = snapshot.eligibleEmployees.length;
      const readyToProcessEmployees = Math.max(0, realtimeEligibleEmployees - snapshot.issues.length);

      const processedCountByRun = new Map<string, number>();
      const cachedCalculations = queryClient.getQueryData<Array<{ payroll_run_id?: string }>>(
        payrollCalculationsQueryKey(organizationId, null),
      );

      if (cachedCalculations?.length) {
        cachedCalculations.forEach((row) => {
          const rid = row.payroll_run_id;
          if (!rid) return;
          processedCountByRun.set(rid, (processedCountByRun.get(rid) || 0) + 1);
        });
      } else if (runIds.length > 0) {
        const { data: calculationsRows, error: calculationsError } = await supabase
          .from("employee_payroll_calculations")
          .select("payroll_run_id")
          .in("payroll_run_id", runIds);

        if (!calculationsError && calculationsRows) {
          calculationsRows.forEach((row) => {
            const rid = row.payroll_run_id as string;
            processedCountByRun.set(rid, (processedCountByRun.get(rid) || 0) + 1);
          });
        }
      }

      return (data as PayrollRun[]).map((run) => ({
        ...run,
        realtime_eligible_employees: realtimeEligibleEmployees,
        ready_to_process_employees: readyToProcessEmployees,
        processed_employees_count: processedCountByRun.get(run.id) || 0,
      }));
    },
    enabled: !!organizationId,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft":
        return "bg-muted text-foreground";
      case "processing":
        return "bg-primary/15 text-primary";
      case "calculated":
        return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
      case "paid":
        return "bg-blue-500/15 text-blue-700 dark:text-blue-400";
      case "completed":
        return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
      case "cancelled":
        return "bg-destructive/15 text-destructive";
      default:
        return "bg-muted text-foreground";
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="bg-muted h-20 rounded-md" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {runs?.map((run) => (
        <Card
          key={run.id}
          className={cn(
            "cursor-pointer p-3 transition-all hover:shadow-sm",
            selectedRunId === run.id
              ? "border-primary bg-primary/5 shadow-md"
              : "hover:border-primary/40 border-border",
          )}
          onClick={() => onRunSelect?.(selectedRunId === run.id ? null : run.id)}
        >
          <CardContent className="p-0">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  onClick={(e) => handleProcessPayroll(run.id, e)}
                  disabled={processingRunId === run.id}
                >
                  {processingRunId === run.id ? (
                    <Loader2 className="text-primary h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="text-primary h-4 w-4" />
                  )}
                </Button>
                <span className="text-foreground text-sm font-medium">{run.run_name}</span>
              </div>
              <Badge className={getStatusColor(run.status)} variant="secondary">
                {run.status}
              </Badge>
            </div>
            <div className="space-y-2">
              <div className="text-muted-foreground flex items-center space-x-2 text-xs">
                <span>{run.payroll_periods?.period_name}</span>
              </div>
              <div className="text-muted-foreground flex items-center justify-between text-xs">
                <div className="flex items-center space-x-1">
                  <Users className="h-3 w-3" />
                  <span>{run.realtime_eligible_employees ?? run.total_employees ?? 0} eligible now</span>
                </div>
              </div>
              <div className="text-muted-foreground text-[11px]">
                Ready to process: {run.ready_to_process_employees ?? 0}
              </div>
              <div className="text-muted-foreground text-[11px]">
                Processed in this run: {run.processed_employees_count ?? run.total_employees ?? 0}
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="text-center">
                  <div className="text-muted-foreground">Gross Pay</div>
                  <div className="font-medium text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(run.total_gross_pay || 0)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-muted-foreground">Deductions</div>
                  <div className="text-destructive font-medium">{formatCurrency(run.total_deductions || 0)}</div>
                </div>
                <div className="text-center">
                  <div className="text-muted-foreground">Net Pay</div>
                  <div className="text-primary font-medium">{formatCurrency(run.total_net_pay || 0)}</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {(!runs || runs.length === 0) && (
        <div className="text-muted-foreground py-6 text-center">
          <Play className="mx-auto mb-2 h-8 w-8 opacity-50" />
          <p className="text-sm">No payroll runs found</p>
        </div>
      )}
    </div>
  );
}
