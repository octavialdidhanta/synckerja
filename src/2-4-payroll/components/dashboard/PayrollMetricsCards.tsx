import { TrendingUp, DollarSign, Calculator, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";

interface PayrollMetricsCardsProps {
  calculations: Record<string, unknown>[];
  selectedPayrollRunId?: string | null;
}

export function PayrollMetricsCards({ calculations, selectedPayrollRunId }: PayrollMetricsCardsProps) {
  const { data: selectedPayrollRun } = useQuery({
    queryKey: ["payroll-run-details", selectedPayrollRunId],
    queryFn: async () => {
      if (!selectedPayrollRunId) return null;

      const { data, error } = await supabase
        .from("payroll_runs")
        .select(
          "id, total_employees, total_gross_pay, total_net_pay, total_deductions, total_penalties, total_taxes",
        )
        .eq("id", selectedPayrollRunId)
        .single();

      if (error) throw error;
      return data as Record<string, unknown>;
    },
    enabled: !!selectedPayrollRunId,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const metrics = selectedPayrollRun
    ? [
        {
          title: "Total Employees",
          value: selectedPayrollRun.total_employees || 0,
          icon: Calculator,
          color: "text-primary",
          bgColor: "bg-primary/10",
          borderColor: "border-primary/20",
          subtitle: "In selected run",
        },
        {
          title: "Total Gross Pay",
          value: formatCurrency(Number(selectedPayrollRun.total_gross_pay) || 0),
          icon: TrendingUp,
          color: "text-emerald-600 dark:text-emerald-400",
          bgColor: "bg-emerald-500/10",
          borderColor: "border-emerald-500/20",
          subtitle: "In selected run",
        },
        {
          title: "Total Net Pay",
          value: formatCurrency(Number(selectedPayrollRun.total_net_pay) || 0),
          icon: DollarSign,
          color: "text-teal-600 dark:text-teal-400",
          bgColor: "bg-teal-500/10",
          borderColor: "border-teal-500/20",
          subtitle: "In selected run",
        },
        {
          title: "Total Deductions",
          value: formatCurrency(
            (Number(selectedPayrollRun.total_deductions) || 0) +
              (Number(selectedPayrollRun.total_penalties) || 0),
          ),
          icon: AlertTriangle,
          color: "text-destructive",
          bgColor: "bg-destructive/10",
          borderColor: "border-destructive/20",
          subtitle: "In selected run",
        },
      ]
    : [
        {
          title: "Total Calculations",
          value: calculations?.length || 0,
          icon: Calculator,
          color: "text-primary",
          bgColor: "bg-primary/10",
          borderColor: "border-primary/20",
          subtitle: "All calculations",
        },
        {
          title: "Total Gross Pay",
          value: formatCurrency(
            calculations?.reduce((sum, calc) => sum + (Number(calc.gross_pay) || 0), 0) || 0,
          ),
          icon: TrendingUp,
          color: "text-emerald-600 dark:text-emerald-400",
          bgColor: "bg-emerald-500/10",
          borderColor: "border-emerald-500/20",
          subtitle: "All calculations",
        },
        {
          title: "Total Net Pay",
          value: formatCurrency(
            calculations?.reduce((sum, calc) => sum + (Number(calc.net_pay) || 0), 0) || 0,
          ),
          icon: DollarSign,
          color: "text-teal-600 dark:text-teal-400",
          bgColor: "bg-teal-500/10",
          borderColor: "border-teal-500/20",
          subtitle: "All calculations",
        },
        {
          title: "Total Deductions",
          value: formatCurrency(
            calculations?.reduce(
              (sum, calc) =>
                sum + (Number(calc.total_deductions) || 0) + (Number(calc.total_penalties) || 0),
              0,
            ) || 0,
          ),
          icon: AlertTriangle,
          color: "text-destructive",
          bgColor: "bg-destructive/10",
          borderColor: "border-destructive/20",
          subtitle: "All calculations",
        },
      ];

  return (
    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric, index) => {
        const Icon = metric.icon;
        return (
          <div
            key={index}
            className={`${metric.bgColor} ${metric.borderColor} rounded-md border p-4`}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-foreground text-sm font-medium">{metric.title}</h3>
              <Icon className={`h-5 w-5 ${metric.color}`} />
            </div>

            <div className="space-y-1">
              <div className="text-foreground truncate text-2xl font-bold">{metric.value}</div>
              <div className="text-muted-foreground text-xs">{metric.subtitle}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
