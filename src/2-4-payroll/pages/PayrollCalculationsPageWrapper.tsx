import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCentralizedUserData } from "@/shared/auth/contexts/CentralizedUserDataContext";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useDebouncedReady } from "@/shared/hooks/useDebouncedReady";
import { cn } from "@/shared/lib/utils";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { PayrollCalculationsTable } from "../calculations/PayrollCalculationsTable";
import { PayrollFilters } from "../components/filters/PayrollFilters";
import { PayrollMetricsCards } from "../components/dashboard/PayrollMetricsCards";
import { PayrollSidebar } from "../components/sidebar/PayrollSidebar";
import { EmployeeDetailView } from "../views/EmployeeDetailView";
import { HeaderAndTab } from "./HeaderAndTab";
import { ModuleShellContentGate } from "@/shared/layouts/ModuleShellContentGate";
import { PayrollRouteSkeleton } from "../components/PayrollRouteSkeleton";
import { formatPayrollDataError } from "../lib/payrollQueryErrors";

/** Columns + joins required by list, filters, metrics, detail, and delete. */
const PAYROLL_CALCULATIONS_LIST_SELECT = `
  id,
  organization_id,
  employee_id,
  employee_payroll_info_id,
  payroll_period_id,
  payroll_run_id,
  tax_configuration_id,
  basic_salary,
  total_allowances,
  total_deductions,
  total_penalties,
  total_tax_deductions,
  gross_pay,
  net_pay,
  take_home_pay,
  total_taxes,
  calculation_status,
  calculation_date,
  payment_status,
  payment_date,
  payment_method,
  payment_reference,
  notes,
  created_at,
  updated_at,
  employee_payroll_info(
    basic_salary,
    ptkp_status,
    employees(
      id, full_name, employee_id, organization_id,
      departments(name),
      job_positions(name)
    )
  ),
  payroll_runs(
    id, run_name, run_date, status,
    payroll_periods(
      id, period_name, start_date, end_date, pay_date
    )
  )
`;

type PayrollItemRow = {
  item_type?: string;
  component_type?: string;
  [key: string]: unknown;
};

function isAllowanceItem(item: PayrollItemRow) {
  return item.item_type === "allowance" || item.component_type === "allowance";
}

function isDeductionItem(item: PayrollItemRow) {
  return item.item_type === "deduction" || item.component_type === "deduction";
}

export default function PayrollCalculationsPage() {
  const { t } = useAppTranslation();
  const { organization, loading: userDataLoading } = useCentralizedUserData();
  const { loading: orgProfileLoading } = useCurrentOrg();
  const organizationId = organization?.id ?? null;

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [selectedPayrollRunId, setSelectedPayrollRunId] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Record<string, unknown> | null>(null);
  const [runBlockedMessage, setRunBlockedMessage] = useState<string | null>(null);
  const [deletingCalculationId, setDeletingCalculationId] = useState<string | null>(null);

  const {
    data: calculations = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["payroll-calculations", organizationId, selectedPayrollRunId],
    queryFn: async () => {
      if (!organizationId) return [];

      let query = supabase
        .from("employee_payroll_calculations")
        .select(PAYROLL_CALCULATIONS_LIST_SELECT)
        .eq("organization_id", organizationId);

      if (selectedPayrollRunId) {
        query = query.eq("payroll_run_id", selectedPayrollRunId);
      }

      const { data, error: qError } = await query.order("created_at", { ascending: false });

      if (qError) throw qError;
      return data ?? [];
    },
    enabled: !!organizationId,
  });

  useEffect(() => {
    if (isError && error) {
      toast.error(formatPayrollDataError(error));
    }
  }, [isError, error]);

  const filteredCalculations = useMemo(() => {
    return calculations.filter((calc: Record<string, unknown>) => {
      const info = calc.employee_payroll_info as
        | {
            employees?: { full_name?: string; employee_id?: string | null };
          }
        | undefined;
      const name = info?.employees?.full_name?.toLowerCase() ?? "";
      const eid = (info?.employees?.employee_id ?? "").toString().toLowerCase();
      const q = searchTerm.trim().toLowerCase();
      if (q && !name.includes(q) && !eid.includes(q)) return false;
      const cs = (calc.calculation_status as string) || "draft";
      const ps = (calc.payment_status as string) || "pending";
      if (statusFilter !== "all" && cs !== statusFilter) return false;
      if (paymentFilter !== "all" && ps !== paymentFilter) return false;
      return true;
    });
  }, [calculations, searchTerm, statusFilter, paymentFilter]);

  const taxAmounts = filteredCalculations.reduce(
    (acc: Record<string, number>, calc: { id: string; total_tax_deductions?: number | null }) => {
      acc[calc.id] = calc.total_tax_deductions || 0;
      return acc;
    },
    {},
  );

  const { data: payrollItems = [] } = useQuery<PayrollItemRow[]>({
    queryKey: ["payroll-items", selectedEmployee?.id],
    queryFn: async () => {
      if (!selectedEmployee?.id) return [];
      const { data, error: itemsError } = await supabase
        .from("payroll_items")
        .select(
          "id, item_name, item_type, item_category, item_description, calculated_amount, component_id, organization_id",
        )
        .eq("payroll_calculation_id", selectedEmployee.id as string);

      if (itemsError) return [];
      return (data ?? []) as PayrollItemRow[];
    },
    enabled: !!selectedEmployee?.id,
  });

  const handleDeleteCalculation = async (calculation: Record<string, unknown>) => {
    if (!organizationId || !calculation?.id) return;

    if (calculation.payment_status === "paid") {
      toast.error("Payroll dengan status paid tidak dapat dihapus.");
      return;
    }

    const emp = calculation.employee_payroll_info as
      | { employees?: { full_name?: string } }
      | undefined;
    const employeeName = emp?.employees?.full_name || "this employee";
    const confirmed = window.confirm(
      `Delete payroll calculation for ${employeeName}? This action cannot be undone.`,
    );
    if (!confirmed) return;

    try {
      setDeletingCalculationId(calculation.id as string);

      const { error: itemsDeleteError } = await supabase
        .from("payroll_items")
        .delete()
        .eq("payroll_calculation_id", calculation.id as string);

      if (itemsDeleteError) throw itemsDeleteError;

      const { error: calculationDeleteError } = await supabase
        .from("employee_payroll_calculations")
        .delete()
        .eq("id", calculation.id as string);

      if (calculationDeleteError) throw calculationDeleteError;

      if (selectedEmployee?.id === calculation.id) {
        setSelectedEmployee(null);
      }

      toast.success("Payroll calculation deleted successfully.");
      await refetch();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to delete payroll calculation.");
    } finally {
      setDeletingCalculationId(null);
    }
  };

  const listInitialPending =
    !!organizationId && isLoading && calculations.length === 0 && !selectedEmployee;
  const rawLoading = userDataLoading || orgProfileLoading || listInitialPending;
  const showContentReady = useDebouncedReady(!rawLoading, 220);
  const showShellSkeleton = !showContentReady;
  const loadingAria = t("payroll.page.loadingAria", "Loading payroll");

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-gray-100 font-sans">
      <div
        className={cn(
          "flex min-h-0 min-w-0 w-full flex-1 flex-col px-4 pb-2",
          showShellSkeleton && "pointer-events-none invisible",
        )}
      >
        <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex-1 h-full min-h-0 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-h-full flex-col">
              <div className="mb-1 flex-shrink-0">
                <HeaderAndTab />
              </div>

              <ModuleShellContentGate>
              <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-1 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch xl:grid-cols-12">
                {selectedEmployee ? (
                  <div className="col-span-full flex h-full min-h-0 min-w-0 flex-col self-stretch overflow-hidden">
                    <EmployeeDetailView
                      selectedEmployee={selectedEmployee}
                      onBack={() => setSelectedEmployee(null)}
                      allowanceData={payrollItems.filter(isAllowanceItem)}
                      deductionData={payrollItems.filter(isDeductionItem)}
                      taxData={[]}
                      tardinessData={[]}
                      attendancePenalties={[]}
                    />
                  </div>
                ) : (
                  <>
                    <div className="col-span-full flex h-full min-h-0 min-w-0 flex-col self-stretch overflow-hidden xl:col-span-9">
                      <div className="mb-2 shrink-0">
                        <div className="rounded-md border border-border bg-card p-2">
                          <PayrollFilters
                            searchTerm={searchTerm}
                            setSearchTerm={setSearchTerm}
                            statusFilter={statusFilter}
                            setStatusFilter={setStatusFilter}
                            paymentFilter={paymentFilter}
                            setPaymentFilter={setPaymentFilter}
                          />
                        </div>
                      </div>

                      <div className="mb-2 shrink-0">
                        <PayrollMetricsCards
                          calculations={filteredCalculations}
                          selectedPayrollRunId={selectedPayrollRunId}
                        />
                      </div>

                      {runBlockedMessage && (
                        <div className="mb-2 shrink-0 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900/50 dark:bg-amber-950/30">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                            <pre className="font-sans text-xs whitespace-pre-wrap text-amber-900 dark:text-amber-100">
                              {runBlockedMessage}
                            </pre>
                          </div>
                        </div>
                      )}

                      <div className="flex min-h-[560px] min-w-0 flex-1 flex-col [@media(max-height:900px)]:min-h-[620px] [@media(max-height:760px)]:min-h-[680px]">
                        <div className="flex h-full min-h-0 min-w-0 flex-col rounded-lg border border-border bg-card shadow-sm">
                          <PayrollCalculationsTable
                            calculations={filteredCalculations}
                            totalUnfiltered={calculations.length}
                            taxAmounts={taxAmounts}
                            isLoading={isLoading}
                            onEmployeeSelect={setSelectedEmployee}
                            onRefresh={() => refetch()}
                            onDeleteCalculation={handleDeleteCalculation}
                            deletingCalculationId={deletingCalculationId}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="col-span-full flex h-full min-h-0 min-w-0 flex-col self-stretch xl:col-span-3">
                      <div className="flex h-full min-h-0 flex-col rounded-lg border border-border bg-card shadow-sm">
                        <PayrollSidebar
                          selectedPayrollRunId={selectedPayrollRunId}
                          onPayrollRunSelect={setSelectedPayrollRunId}
                          onRunBlocked={setRunBlockedMessage}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
              </ModuleShellContentGate>
              <div
                className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
                aria-hidden
              />
            </div>
          </div>
        </div>
      </div>

      {showShellSkeleton ? (
        <div
          className="absolute inset-0 z-10 flex flex-col overflow-hidden bg-gray-100"
          aria-busy="true"
          aria-label={loadingAria}
        >
          <PayrollRouteSkeleton embedded />
        </div>
      ) : null}
    </div>
  );
}
