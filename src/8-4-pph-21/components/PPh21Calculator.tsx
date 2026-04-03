import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Separator } from "@/shared/components/ui/separator";
import { Calculator, Download, FileText, TrendingUp } from "lucide-react";
import { usePPh21Calculator } from "../hooks/usePPh21Calculator";

export function PPh21Calculator() {
  const {
    mode,
    setMode,
    salary,
    setSalary,
    ptkpStatus,
    setPtkpStatus,
    customPtkp,
    setCustomPtkp,
    bpjsKesehatan,
    setBpjsKesehatan,
    bpjsPensiun,
    setBpjsPensiun,
    nonTaxableAllowance,
    setNonTaxableAllowance,
    salaryIncrease,
    setSalaryIncrease,
    result,
    increaseResult,
    handleCalculate,
    handleExportPdf,
    handleExportExcel,
    formatCurrency,
    PTKP_RATES,
    BPJS_KESEHATAN_MAX_SALARY,
    BPJS_PENSIUN_MAX_SALARY,
  } = usePPh21Calculator();

  const exportDisabled = !result;

  return (
    <div className="mx-auto max-w-6xl space-y-2 p-2">
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        <Card className="border-brand-blue/20 shadow-sm ring-1 ring-brand-blue/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base text-foreground">
              <Calculator className="h-5 w-5 text-brand-blue" />
              Parameter Perhitungan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-base font-semibold">1. Pilih Mode Perhitungan</Label>
              <RadioGroup
                value={mode}
                onValueChange={(value) => setMode(value as "gross-to-net" | "net-to-gross")}
                className="mt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="gross-to-net" id="gross-to-net" />
                  <Label htmlFor="gross-to-net">Gaji Bruto → Take-Home Pay</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="net-to-gross" id="net-to-gross" />
                  <Label htmlFor="net-to-gross">Take-Home Pay → Gaji Bruto</Label>
                </div>
              </RadioGroup>
            </div>

            <Separator />

            <div>
              <Label className="text-base font-semibold">
                2. {mode === "gross-to-net" ? "Gaji Bruto per Bulan" : "Take-Home Pay per Bulan"}
              </Label>
              <Input
                type="text"
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
                placeholder="Rp 12.500.000"
                className="mt-2"
              />
            </div>

            <Separator />

            <div>
              <Label className="text-base font-semibold">3. Status PTKP</Label>
              <RadioGroup
                value={ptkpStatus}
                onValueChange={setPtkpStatus}
                className="mt-2 grid grid-cols-2 gap-2"
              >
                {Object.entries(PTKP_RATES).map(([status, amount]) => (
                  <div key={status} className="flex items-center space-x-2">
                    <RadioGroupItem value={status} id={status} />
                    <Label htmlFor={status} className="text-sm">
                      {status} ({formatCurrency(amount)})
                    </Label>
                  </div>
                ))}
                <div className="col-span-2 flex items-center space-x-2">
                  <RadioGroupItem value="custom" id="custom" />
                  <Label htmlFor="custom">Custom</Label>
                  {ptkpStatus === "custom" && (
                    <Input
                      type="text"
                      value={customPtkp}
                      onChange={(e) => setCustomPtkp(e.target.value)}
                      placeholder="Rp 54.000.000"
                      className="ml-2 flex-1"
                    />
                  )}
                </div>
              </RadioGroup>
            </div>

            <Separator />

            <div>
              <Label className="text-base font-semibold">4. Potongan BPJS</Label>
              <div className="mt-2 space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="bpjs-kesehatan"
                    checked={bpjsKesehatan}
                    onCheckedChange={(checked) => setBpjsKesehatan(checked === true)}
                  />
                  <Label htmlFor="bpjs-kesehatan">
                    BPJS Kesehatan (Employee: 2%, Company: 3%)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="bpjs-pensiun"
                    checked={bpjsPensiun}
                    onCheckedChange={(checked) => setBpjsPensiun(checked === true)}
                  />
                  <Label htmlFor="bpjs-pensiun">BPJS Pensiun (Employee: 1%, Company: 2%)</Label>
                </div>

                <div className="rounded-lg border border-brand-blue/20 bg-brand-blue/5 p-3">
                  <Label className="mb-2 block text-sm font-medium text-brand-blue">
                    ℹ️ Perhitungan BPJS Otomatis:
                  </Label>
                  <div className="space-y-1 text-xs text-brand-blue-deep">
                    <p>
                      • Jika gaji ≤ {formatCurrency(BPJS_KESEHATAN_MAX_SALARY)}: BPJS Kesehatan = 2% ×
                      gaji
                    </p>
                    <p>
                      • Jika gaji {`>`} {formatCurrency(BPJS_KESEHATAN_MAX_SALARY)}: BPJS Kesehatan = 2%
                      × {formatCurrency(BPJS_KESEHATAN_MAX_SALARY)}
                    </p>
                    <p>
                      • Jika gaji ≤ {formatCurrency(BPJS_PENSIUN_MAX_SALARY)}: BPJS Pensiun = 1% × gaji
                    </p>
                    <p>
                      • Jika gaji {`>`} {formatCurrency(BPJS_PENSIUN_MAX_SALARY)}: BPJS Pensiun = 1% ×{" "}
                      {formatCurrency(BPJS_PENSIUN_MAX_SALARY)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <Label className="text-base font-semibold">5. Tunjangan Tidak Kena Pajak (Opsional)</Label>
              <Input
                type="text"
                value={nonTaxableAllowance}
                onChange={(e) => setNonTaxableAllowance(e.target.value)}
                placeholder="Rp 0"
                className="mt-2"
              />
            </div>

            <Separator />

            <div>
              <Label className="text-base font-semibold">6. Simulasi Kenaikan Gaji (%)</Label>
              <Input
                type="number"
                value={salaryIncrease}
                onChange={(e) => setSalaryIncrease(e.target.value)}
                placeholder="10"
                className="mt-2"
              />
            </div>

            <Button onClick={handleCalculate} className="w-full bg-brand-blue text-white hover:bg-brand-blue-deep" size="lg">
              <Calculator className="mr-2 h-4 w-4" />
              Hitung PPh 21
            </Button>
          </CardContent>
        </Card>

        {result && (
          <Card className="border-brand-blue/20 shadow-sm ring-1 ring-brand-blue/10">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base text-foreground">
                <FileText className="h-5 w-5 text-brand-blue" />
                Hasil Perhitungan
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportPdf}
                  disabled={exportDisabled}
                  className="border-brand-blue/30"
                >
                  <Download className="mr-1 h-4 w-4" />
                  PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportExcel}
                  disabled={exportDisabled}
                  className="border-brand-blue/30"
                >
                  <Download className="mr-1 h-4 w-4" />
                  Excel
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="rounded-lg border border-border bg-muted/40 p-4">
                <h3 className="mb-2 font-semibold text-foreground">✅ Rincian Perhitungan</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Gaji setahun:</span>
                    <span className="font-medium">{formatCurrency(result.annualGross)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Biaya jabatan (5%):</span>
                    <span className="font-medium">{formatCurrency(result.professionalAllowance)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>BPJS Kesehatan:</span>
                    <span className="font-medium">{formatCurrency(result.bpjsKesehatan)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>BPJS Pensiun:</span>
                    <span className="font-medium">{formatCurrency(result.bpjsPensiun)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Penghasilan neto:</span>
                    <span className="font-medium">{formatCurrency(result.netIncome)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>PTKP:</span>
                    <span className="font-medium">{formatCurrency(result.ptkp)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>PKP:</span>
                    <span className="font-medium">{formatCurrency(result.pkp)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-semibold">
                    <span>PPh 21 setahun:</span>
                    <span className="text-destructive">{formatCurrency(result.annualTax)}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span>PPh 21 per bulan:</span>
                    <span className="text-destructive">{formatCurrency(result.monthlyTax)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold">
                    <span>Take-home pay/bulan:</span>
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(result.takeHomePay)}
                    </span>
                  </div>
                  <Separator className="my-2" />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total biaya perusahaan/bulan:</span>
                    <span className="text-primary">{formatCurrency(result.totalCompanyCost)}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    (Gaji bruto + BPJS Kesehatan {formatCurrency(result.bpjsKesehatanCompany / 12)}
                    /bln + BPJS Pensiun {formatCurrency(result.bpjsPensiunCompany / 12)}/bln)
                  </div>
                </div>
              </div>

              {result.pkp > 0 && (
                <div className="rounded-lg border border-brand-blue/25 bg-brand-blue/5 p-6">
                  <h4 className="mb-4 text-base font-semibold text-brand-blue">
                    Gunakan tarif progresif PPh 21 (berdasarkan Pasal 17 UU PPh):
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse overflow-hidden rounded-lg bg-card shadow-sm">
                      <thead>
                        <tr className="bg-primary text-primary-foreground">
                          <th className="px-4 py-3 text-left font-semibold">Lapisan Penghasilan</th>
                          <th className="w-24 px-4 py-3 text-center font-semibold">Tarif</th>
                          <th className="px-4 py-3 text-right font-semibold">Pajak per Lapisan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.taxBreakdown.map((breakdown, index) => (
                          <tr key={index} className="border-b border-border hover:bg-muted/50">
                            <td className="px-4 py-3 font-medium">{breakdown.bracket}</td>
                            <td className="px-4 py-3 text-center font-semibold text-brand-blue">
                              {breakdown.rate.toFixed(0)}%
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex flex-col items-end">
                                <div className="mb-1 text-sm text-muted-foreground">
                                  {breakdown.rate.toFixed(0)}% × {formatCurrency(breakdown.amount)} =
                                </div>
                                <div className="text-base font-bold text-destructive">
                                  {formatCurrency(breakdown.tax)}
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))}
                        <tr className="border-t-2 border-primary bg-brand-blue/10">
                          <td className="px-4 py-4 font-bold text-foreground">Total PPh 21 Tahunan</td>
                          <td className="px-4 py-4 text-center font-bold">-</td>
                          <td className="px-4 py-4 text-right">
                            <div className="text-lg font-bold text-destructive">
                              {formatCurrency(result.annualTax)}
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {increaseResult && (
                <div className="rounded-lg border border-secondary bg-secondary/30 p-4">
                  <h4 className="mb-2 flex items-center gap-2 font-semibold text-foreground">
                    <TrendingUp className="h-4 w-4" />
                    Simulasi Kenaikan Gaji {salaryIncrease}%
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Gaji baru per bulan:</span>
                      <span className="font-medium">
                        {formatCurrency(increaseResult.annualGross / 12)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>PPh 21 baru per bulan:</span>
                      <span className="font-medium text-destructive">
                        {formatCurrency(increaseResult.monthlyTax)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Take-home pay baru:</span>
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(increaseResult.takeHomePay)}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-semibold">
                      <span>Selisih PPh 21:</span>
                      <span className="text-destructive">
                        +{formatCurrency(increaseResult.monthlyTax - result.monthlyTax)}
                      </span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span>Selisih take-home:</span>
                      <span className="text-emerald-600 dark:text-emerald-400">
                        +{formatCurrency(increaseResult.takeHomePay - result.takeHomePay)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="border-border">
        <CardContent className="space-y-2 pt-3 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">Referensi:</strong> UU PPh Pasal 17 dan PER-16/PJ/2016
          </p>
          <p>
            <strong className="text-foreground">Catatan:</strong> Perhitungan ini adalah simulasi dan
            tidak menggantikan konsultasi dengan konsultan pajak profesional.
          </p>
          <p>
            <strong className="text-foreground">Peringatan:</strong> Pastikan input valid dan sesuai
            dengan ketentuan perpajakan yang berlaku.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
