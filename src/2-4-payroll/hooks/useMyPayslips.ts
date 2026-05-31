import { useEffect, useState } from "react";
import { supabase } from "@/shared/lib/supabaseClient";

export interface MyPayslipRow {
  id: string;
  take_home_pay: number;
  gross_pay: number;
  payment_date: string | null;
  payout_snapshot: Record<string, string> | null;
  payroll_runs: {
    run_name: string;
    payroll_periods: { period_name: string; pay_date: string | null } | null;
  } | null;
}

export function useMyPayslips() {
  const [payslips, setPayslips] = useState<MyPayslipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) {
          setPayslips([]);
          return;
        }

        const { data: employee, error: empError } = await supabase
          .from("employees")
          .select("id")
          .eq("user_id", auth.user.id)
          .maybeSingle();

        if (empError) throw empError;
        if (!employee?.id) {
          setPayslips([]);
          return;
        }

        const { data, error: qError } = await supabase
          .from("employee_payroll_calculations")
          .select(
            `
            id, take_home_pay, gross_pay, payment_date, payout_snapshot,
            payroll_runs(run_name, payroll_periods(period_name, pay_date))
          `,
          )
          .eq("employee_id", employee.id)
          .eq("payment_status", "paid")
          .order("payment_date", { ascending: false });

        if (qError) throw qError;
        if (!cancelled) setPayslips((data as MyPayslipRow[]) ?? []);
      } catch (err) {
        if (!cancelled) setError(err as Error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { payslips, loading, error };
}
