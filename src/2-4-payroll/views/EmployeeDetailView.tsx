import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { ArrowLeft, Calculator } from "lucide-react";
import { calculatePPh21, formatCurrency } from "@/shared/lib/pph21Calculator";

interface LineItem {
  component_name?: string;
  item_name?: string;
  calculated_amount?: number;
  [key: string]: unknown;
}

interface EmployeeDetailViewProps {
  selectedEmployee: Record<string, unknown>;
  onBack: () => void;
  allowanceData?: LineItem[];
  deductionData?: LineItem[];
  taxData?: LineItem[];
  tardinessData?: Record<string, unknown>[];
  attendancePenalties?: Record<string, unknown>[];
}

function lineLabel(item: LineItem) {
  return (item.component_name || item.item_name || "").toString();
}

export function EmployeeDetailView({
  selectedEmployee,
  onBack,
  allowanceData = [],
  deductionData = [],
  taxData = [],
  tardinessData = [],
  attendancePenalties = [],
}: EmployeeDetailViewProps) {
  if (!selectedEmployee) return null;

  const getCalculationData = () => {
    const info = selectedEmployee.employee_payroll_info as Record<string, unknown> | undefined;
    const basicSalary = Number(info?.basic_salary) || 0;

    const totalAllowances =
      allowanceData?.reduce((sum, item) => sum + (Number(item.calculated_amount) || 0), 0) ||
      Number(selectedEmployee.total_allowances) ||
      0;

    const grossPay = basicSalary + totalAllowances;

    const ptkpStatus = (info?.ptkp_status as string) || "TK/0";
    const pph21Result = calculatePPh21({
      monthlyGross: grossPay,
      ptkpStatus,
      includeBpjsKesehatan: true,
      includeBpjsPensiun: true,
      nonTaxableAllowance: 0,
    });

    const bpjsKesehatanMonthly = pph21Result.bpjsKesehatanEmployee / 12;
    const bpjsPensiunMonthly = pph21Result.bpjsPensiunEmployee / 12;

    const tardinessAmount = (tardinessData.length > 0 ? tardinessData : attendancePenalties).reduce(
      (sum, item) => sum + (Number(item.penalty_amount) || 0),
      0,
    );

    const otherDeductions =
      deductionData
        ?.filter((item) => !lineLabel(item).toLowerCase().includes("bpjs"))
        .reduce((sum, item) => sum + (Number(item.calculated_amount) || 0), 0) || 0;

    const totalDeductionsForCard =
      bpjsKesehatanMonthly + bpjsPensiunMonthly + otherDeductions + tardinessAmount;

    const totalTax = taxData?.reduce((sum, item) => sum + (Number(item.calculated_amount) || 0), 0) || 0;

    const netPay = grossPay - totalDeductionsForCard - totalTax;

    return {
      basicSalary,
      totalAllowances,
      grossPay,
      totalDeductions: totalDeductionsForCard,
      totalTax,
      netPay,
      pph21Result,
      ptkpStatus,
      bpjsKesehatanMonthly,
      bpjsPensiunMonthly,
      otherDeductions,
      tardinessAmount,
    };
  };

  const calculationData = getCalculationData();

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft":
        return "bg-muted text-foreground";
      case "calculated":
        return "bg-primary/15 text-primary";
      case "approved":
        return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
      case "paid":
        return "bg-violet-500/15 text-violet-700 dark:text-violet-400";
      default:
        return "bg-muted text-foreground";
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-amber-500/15 text-amber-800 dark:text-amber-300";
      case "processing":
        return "bg-primary/15 text-primary";
      case "paid":
        return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
      case "failed":
        return "bg-destructive/15 text-destructive";
      default:
        return "bg-muted text-foreground";
    }
  };

  const runs = selectedEmployee.payroll_runs as
    | { payroll_periods?: { period_name?: string; pay_date?: string } }
    | undefined;
  const empInfo = selectedEmployee.employee_payroll_info as
    | { employees?: { full_name?: string; employee_id?: string; departments?: { name?: string } } }
    | undefined;

  return (
    <div className="bg-background h-full">
      <div className="bg-muted/30 border-border sticky top-0 z-10 flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="h-8 w-8 p-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-foreground text-xl font-semibold">{empInfo?.employees?.full_name}</h2>
            <p className="text-muted-foreground text-sm">{empInfo?.employees?.employee_id}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={getStatusColor(String(selectedEmployee.calculation_status || "draft"))}>
            {String(selectedEmployee.calculation_status || "draft")}
          </Badge>
          <Badge className={getPaymentStatusColor(String(selectedEmployee.payment_status || "pending"))}>
            {String(selectedEmployee.payment_status || "pending")}
          </Badge>
        </div>
      </div>

      <div className="space-y-6 p-6">
        <Card>
          <CardHeader>
            <CardTitle>Informasi Periode</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-muted-foreground text-sm font-medium">Periode Payroll</label>
                <p className="text-foreground text-sm font-semibold">
                  {runs?.payroll_periods?.period_name || "-"}
                </p>
              </div>
              <div>
                <label className="text-muted-foreground text-sm font-medium">Tanggal Pembayaran</label>
                <p className="text-foreground text-sm font-semibold">
                  {runs?.payroll_periods?.pay_date
                    ? new Date(runs.payroll_periods.pay_date).toLocaleDateString("id-ID")
                    : "-"}
                </p>
              </div>
              <div>
                <label className="text-muted-foreground text-sm font-medium">Tanggal Perhitungan</label>
                <p className="text-foreground text-sm font-semibold">
                  {selectedEmployee.calculation_date
                    ? new Date(String(selectedEmployee.calculation_date)).toLocaleDateString("id-ID")
                    : "-"}
                </p>
              </div>
              <div>
                <label className="text-muted-foreground text-sm font-medium">Departemen</label>
                <p className="text-foreground text-sm font-semibold">
                  {empInfo?.employees?.departments?.name || "No Department"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-muted-foreground mb-1 text-sm font-medium">Gaji Pokok</div>
              <div className="text-primary text-lg font-bold">{formatCurrency(calculationData.basicSalary)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-muted-foreground mb-1 text-sm font-medium">Tunjangan</div>
              <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(calculationData.totalAllowances)}
              </div>
              {allowanceData.length > 0 && (
                <div className="mt-2 space-y-1">
                  {allowanceData.map((item, index) => (
                    <div key={index} className="text-muted-foreground flex justify-between text-xs">
                      <span>{lineLabel(item)}</span>
                      <span>{formatCurrency(Number(item.calculated_amount) || 0)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-muted-foreground mb-1 text-sm font-medium">Potongan</div>
              <div className="text-destructive text-lg font-bold">
                {formatCurrency(calculationData.totalDeductions)}
              </div>
              <div className="mt-2 space-y-1">
                <div className="text-muted-foreground flex justify-between text-xs">
                  <span>BPJS Kesehatan (Bulanan)</span>
                  <span>{formatCurrency(calculationData.bpjsKesehatanMonthly)}</span>
                </div>
                <div className="text-muted-foreground flex justify-between text-xs">
                  <span>BPJS Pensiun (Bulanan)</span>
                  <span>{formatCurrency(calculationData.bpjsPensiunMonthly)}</span>
                </div>

                {deductionData
                  .filter((item) => !lineLabel(item).toLowerCase().includes("bpjs"))
                  .map((item, index) => (
                    <div key={index} className="text-muted-foreground flex justify-between text-xs">
                      <span>{lineLabel(item)}</span>
                      <span>{formatCurrency(Number(item.calculated_amount) || 0)}</span>
                    </div>
                  ))}

                {(tardinessData.length > 0 ? tardinessData : attendancePenalties)
                  .filter((item, index, array) => {
                    const currentKey = `${item.penalty_amount}_${item.applied_date}`;
                    const firstOccurrenceIndex = array.findIndex(
                      (p) => `${p.penalty_amount}_${p.applied_date}` === currentKey,
                    );
                    return index === firstOccurrenceIndex;
                  })
                  .map((item, index) => {
                    const vd = item.violation_details as { late_minutes?: number } | undefined;
                    const minutes = vd?.late_minutes || 0;
                    const displayDate =
                      (item.display_date as string) ||
                      (item.applied_date
                        ? new Date(String(item.applied_date)).toLocaleDateString("id-ID")
                        : "No Date");
                    return (
                      <div key={index} className="text-muted-foreground flex justify-between text-xs">
                        <span>
                          Keterlambatan - {displayDate} ({minutes} menit)
                        </span>
                        <span>{formatCurrency(Number(item.penalty_amount) || 0)}</span>
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-muted-foreground mb-1 text-sm font-medium">Take-Home Pay</div>
              <div className="text-primary text-xl font-bold">
                {formatCurrency(calculationData.netPay)}
              </div>
            </CardContent>
          </Card>
        </div>

        {(taxData.length > 0 || calculationData.pph21Result) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Detail Pajak PPh 21
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">PPh 21 Bulanan</span>
                  <span className="text-primary font-bold">
                    {formatCurrency(
                      calculationData.pph21Result.monthlyTax ||
                        taxData.reduce((sum, item) => sum + (Number(item.calculated_amount) || 0), 0),
                    )}
                  </span>
                </div>

                {calculationData.pph21Result && (
                  <div className="bg-muted/40 rounded-lg p-4">
                    <div className="text-foreground mb-3 text-sm font-medium">Rincian Perhitungan Lengkap:</div>

                    <div className="bg-card mb-3 rounded border p-3">
                      <div className="text-foreground mb-2 text-xs font-medium">Penghasilan Bruto</div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Gaji Pokok/Bulan:</span>
                          <span>{formatCurrency(calculationData.basicSalary)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Total Tunjangan/Bulan:</span>
                          <span>{formatCurrency(calculationData.totalAllowances)}</span>
                        </div>
                        <div className="flex justify-between border-t pt-1 font-medium">
                          <span>Gaji Bruto/Bulan:</span>
                          <span>{formatCurrency(calculationData.grossPay)}</span>
                        </div>
                        <div className="text-primary flex justify-between font-medium">
                          <span>Gaji Bruto Tahunan:</span>
                          <span>{formatCurrency(calculationData.pph21Result.annualGross)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-card mb-3 rounded border p-3">
                      <div className="text-foreground mb-2 text-xs font-medium">Pengurang Penghasilan</div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Biaya Jabatan (5%, maks 6jt):</span>
                          <span>-{formatCurrency(calculationData.pph21Result.professionalAllowance)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>BPJS Kesehatan (Tahunan):</span>
                          <span>-{formatCurrency(calculationData.pph21Result.bpjsKesehatanEmployee)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>BPJS Pensiun (Tahunan):</span>
                          <span>-{formatCurrency(calculationData.pph21Result.bpjsPensiunEmployee)}</span>
                        </div>
                        <div className="flex justify-between border-t pt-1 font-medium text-emerald-700 dark:text-emerald-400">
                          <span>Penghasilan Neto/Bulan:</span>
                          <span>{formatCurrency(calculationData.pph21Result.netIncomeBeforeTax / 12)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-card mb-3 rounded border p-3">
                      <div className="text-foreground mb-2 text-xs font-medium">Penghasilan Tidak Kena Pajak (PTKP)</div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Status PTKP:</span>
                          <span className="font-medium">{calculationData.ptkpStatus}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Nilai PTKP:</span>
                          <span>-{formatCurrency(calculationData.pph21Result.ptkpAmount)}</span>
                        </div>
                        <div className="text-primary flex justify-between border-t pt-1 font-medium">
                          <span>PKP (Penghasilan Kena Pajak):</span>
                          <span>{formatCurrency(calculationData.pph21Result.pkpAmount)}</span>
                        </div>
                      </div>
                    </div>

                    {calculationData.pph21Result.taxBreakdown.length > 0 && (
                      <div className="bg-card rounded border p-3">
                        <div className="text-foreground mb-2 text-xs font-medium">Tarif Progresif PPh 21</div>
                        <div className="space-y-2">
                          {calculationData.pph21Result.taxBreakdown.map((bracket, index) => (
                            <div key={index} className="border-border rounded border p-2">
                              <div className="flex justify-between text-sm font-medium">
                                <span>
                                  Bracket {index + 1}: {bracket.rate}%
                                </span>
                                <span className="text-primary">{formatCurrency(bracket.tax)}</span>
                              </div>
                              <div className="text-muted-foreground mt-1 text-xs">
                                <div>Range: {bracket.bracket}</div>
                                <div>PKP dalam bracket: {formatCurrency(bracket.amount)}</div>
                              </div>
                            </div>
                          ))}
                          <div className="border-border mt-2 border-t-2 pt-2">
                            <div className="text-primary flex justify-between font-bold">
                              <span>Total PPh 21 Tahunan:</span>
                              <span>{formatCurrency(calculationData.pph21Result.annualTax)}</span>
                            </div>
                            <div className="text-primary flex justify-between text-lg font-bold">
                              <span>PPh 21 Bulanan:</span>
                              <span>{formatCurrency(calculationData.pph21Result.monthlyTax)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {selectedEmployee.notes && (
          <Card>
            <CardHeader>
              <CardTitle>Catatan</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-foreground text-sm">{String(selectedEmployee.notes)}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
