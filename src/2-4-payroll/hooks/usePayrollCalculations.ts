import { useState, useEffect } from "react";
import { supabase } from "@/shared/lib/supabaseClient";

export interface PayrollCalculation {
  id: string;
  employee_id: string;
  payroll_run_id: string;
  payroll_period_id: string;
  basic_salary: number;
  total_allowances: number;
  total_deductions: number;
  gross_pay: number;
  net_pay: number;
  take_home_pay: number;
  payment_status: string;
  calculation_status: string;
  payment_date?: string;
  created_at: string;
  updated_at: string;
  employee?: {
    id: string;
    full_name: string;
    employee_id: string;
    department_name?: string;
  };
  payroll_period?: {
    id: string;
    period_name: string;
    start_date: string;
    end_date: string;
    pay_date: string;
    status: string;
  };
}

export function usePayrollCalculations(organizationId?: string) {
  const [calculations, setCalculations] = useState<PayrollCalculation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchPayrollCalculations = async () => {
    if (!organizationId) return;

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: qError } = await supabase
        .from("employee_payroll_calculations")
        .select(
          `
          id,
          employee_id,
          payroll_run_id,
          payroll_period_id,
          basic_salary,
          total_allowances,
          total_deductions,
          gross_pay,
          net_pay,
          take_home_pay,
          payment_status,
          calculation_status,
          payment_date,
          created_at,
          updated_at,
          employees!employee_id (
            id,
            full_name,
            employee_id,
            departments!department_id (
              name
            )
          ),
          payroll_periods!payroll_period_id (
            id,
            period_name,
            start_date,
            end_date,
            pay_date,
            status
          )
        `,
        )
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

      if (qError) throw qError;

      const formattedData: PayrollCalculation[] = (data || []).map((item: Record<string, unknown>) => {
        const emp = item.employees as
          | { id: string; full_name: string; employee_id: string; departments?: { name?: string } }
          | undefined;
        const pp = item.payroll_periods as
          | {
              id: string;
              period_name: string;
              start_date: string;
              end_date: string;
              pay_date: string;
              status: string;
            }
          | undefined;
        return {
          id: item.id as string,
          employee_id: item.employee_id as string,
          payroll_run_id: item.payroll_run_id as string,
          payroll_period_id: item.payroll_period_id as string,
          basic_salary: Number(item.basic_salary) || 0,
          total_allowances: Number(item.total_allowances) || 0,
          total_deductions: Number(item.total_deductions) || 0,
          gross_pay: Number(item.gross_pay) || 0,
          net_pay: Number(item.net_pay) || 0,
          take_home_pay: Number(item.take_home_pay) || 0,
          payment_status: (item.payment_status as string) || "pending",
          calculation_status: (item.calculation_status as string) || "pending",
          payment_date: item.payment_date as string | undefined,
          created_at: item.created_at as string,
          updated_at: item.updated_at as string,
          employee: emp
            ? {
                id: emp.id,
                full_name: emp.full_name,
                employee_id: emp.employee_id,
                department_name: emp.departments?.name,
              }
            : undefined,
          payroll_period: pp
            ? {
                id: pp.id,
                period_name: pp.period_name,
                start_date: pp.start_date,
                end_date: pp.end_date,
                pay_date: pp.pay_date,
                status: pp.status,
              }
            : undefined,
        };
      });

      setCalculations(formattedData);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPayrollCalculations();
  }, [organizationId]);

  return {
    calculations,
    isLoading,
    error,
    refetch: fetchPayrollCalculations,
  };
}
