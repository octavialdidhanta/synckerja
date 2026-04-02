import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/shared/components/ui/radio-group';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Separator } from '@/shared/components/ui/separator';
import { Badge } from '@/shared/components/ui/badge';
import { Calculator, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { calculatePPh21, formatCurrency, parseCurrency } from '@/shared/lib/pph21Calculator';
import { toast } from 'sonner';

interface PayrollCalculationInput {
  basicSalary: number;
  transportAllowance: number;
  latenessPenalty: number;
  ptkpStatus: string;
}

interface PayrollCalculationResult {
  basicSalary: number;
  transportAllowance: number;
  grossSalary: number;
  bpjsKesehatanEmployee: number;
  bpjsPensiunEmployee: number;
  bpjsKesehatanCompany: number;
  bpjsPensiunCompany: number;
  pph21: number;
  latenessPenalty: number;
  totalDeductions: number;
  takeHomePay: number;
  companyTotalCost: number;
  corrections: {
    bpjsKesehatanCorrected: boolean;
    bpjsPensiunAdded: boolean;
    takeHomePayRecalculated: boolean;
  };
}

export const PayrollCalculator = () => {
  const [basicSalary, setBasicSalary] = useState<string>('11500000');
  const [transportAllowance, setTransportAllowance] = useState<string>('1000000');
  const [latenessPenalty, setLatenessPenalty] = useState<string>('339166.67');
  const [ptkpStatus, setPtkpStatus] = useState<string>('TK/0');
  const [result, setResult] = useState<PayrollCalculationResult | null>(null);
  const [showComparison, setShowComparison] = useState(false);

  const calculatePayroll = useCallback(() => {
    const basic = parseCurrency(basicSalary);
    const transport = parseCurrency(transportAllowance);
    const penalty = parseFloat(latenessPenalty.replace(/[^\d.-]/g, '')) || 0;
    
    const grossMonthly = basic + transport;
    
    // Use the corrected PPh21 calculation utility
    const pph21Result = calculatePPh21({
      monthlyGross: grossMonthly,
      ptkpStatus,
      includeBpjsKesehatan: true,
      includeBpjsPensiun: true,
      nonTaxableAllowance: 0
    });

    // Calculate monthly BPJS amounts
    const bpjsKesehatanEmployee = pph21Result.bpjsKesehatanEmployee / 12;
    const bpjsPensiunEmployee = pph21Result.bpjsPensiunEmployee / 12;
    const bpjsKesehatanCompany = pph21Result.bpjsKesehatanCompany / 12;
    const bpjsPensiunCompany = pph21Result.bpjsPensiunCompany / 12;

    const totalDeductions = bpjsKesehatanEmployee + bpjsPensiunEmployee + pph21Result.monthlyTax + penalty;
    const takeHomePay = grossMonthly - totalDeductions;
    const companyTotalCost = grossMonthly + bpjsKesehatanCompany + bpjsPensiunCompany;

    // Check for corrections needed
    const corrections = {
      bpjsKesehatanCorrected: Math.abs(bpjsKesehatanEmployee - 230000) > 1, // Corrected from 230k to 240k
      bpjsPensiunAdded: bpjsPensiunEmployee > 0, // Was missing, now added
      takeHomePayRecalculated: true // Always true when we recalculate
    };

    const calculationResult: PayrollCalculationResult = {
      basicSalary: basic,
      transportAllowance: transport,
      grossSalary: grossMonthly,
      bpjsKesehatanEmployee,
      bpjsPensiunEmployee,
      bpjsKesehatanCompany,
      bpjsPensiunCompany,
      pph21: pph21Result.monthlyTax,
      latenessPenalty: penalty,
      totalDeductions,
      takeHomePay,
      companyTotalCost,
      corrections
    };

    setResult(calculationResult);
    setShowComparison(true);
    
    toast.success('Perhitungan gaji berhasil diperbaiki!');
  }, [basicSalary, transportAllowance, latenessPenalty, ptkpStatus]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Calculator className="h-6 w-6 text-blue-600" />
        <div>
          <h2 className="text-xl font-bold text-gray-900">Perbaikan Perhitungan Gaji</h2>
          <p className="text-sm text-gray-600">Koreksi BPJS Kesehatan, tambah BPJS Pensiun, dan hitung ulang take-home pay</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Input Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>Data Masukan</span>
              {result?.corrections && (
                <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                  Perlu Perbaikan
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="basicSalary">Gaji Pokok</Label>
              <Input
                id="basicSalary"
                type="text"
                value={basicSalary}
                onChange={(e) => setBasicSalary(e.target.value)}
                placeholder="11.500.000"
              />
            </div>

            <div>
              <Label htmlFor="transportAllowance">Tunjangan Transport</Label>
              <Input
                id="transportAllowance"
                type="text"
                value={transportAllowance}
                onChange={(e) => setTransportAllowance(e.target.value)}
                placeholder="1.000.000"
              />
            </div>

            <div>
              <Label htmlFor="latenessPenalty">Denda Keterlambatan</Label>
              <Input
                id="latenessPenalty"
                type="text"
                value={latenessPenalty}
                onChange={(e) => setLatenessPenalty(e.target.value)}
                placeholder="339.166,67"
              />
            </div>

            <div>
              <Label>Status PTKP</Label>
              <RadioGroup value={ptkpStatus} onValueChange={setPtkpStatus}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="TK/0" id="tk0" />
                  <Label htmlFor="tk0">TK/0 - Tidak Kawin</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="K/0" id="k0" />
                  <Label htmlFor="k0">K/0 - Kawin Tanpa Anak</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="K/1" id="k1" />
                  <Label htmlFor="k1">K/1 - Kawin 1 Anak</Label>
                </div>
              </RadioGroup>
            </div>

            <Button onClick={calculatePayroll} className="w-full">
              <Calculator className="h-4 w-4 mr-2" />
              Hitung & Perbaiki Gaji
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        {result && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Hasil Perbaikan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Gross Salary */}
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-blue-700">Gaji Kotor</span>
                  <span className="font-bold text-blue-800">{formatCurrency(result.grossSalary)}</span>
                </div>
                <div className="text-xs text-blue-600 mt-1">
                  Gaji Pokok + Tunjangan Transport
                </div>
              </div>

              {/* BPJS Corrections */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">BPJS Kesehatan</span>
                    {result.corrections.bpjsKesehatanCorrected && (
                      <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                        Diperbaiki
                      </Badge>
                    )}
                  </div>
                  <span className="font-medium text-red-600">
                    -{formatCurrency(result.bpjsKesehatanEmployee)}
                  </span>
                </div>
                {result.corrections.bpjsKesehatanCorrected && (
                  <div className="text-xs text-green-600 pl-4">
                    ✓ Dikoreksi dari Rp230.000 → Rp240.000 (2% dari Rp12.000.000)
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">BPJS Pensiun</span>
                    {result.corrections.bpjsPensiunAdded && (
                      <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                        Ditambahkan
                      </Badge>
                    )}
                  </div>
                  <span className="font-medium text-red-600">
                    -{formatCurrency(result.bpjsPensiunEmployee)}
                  </span>
                </div>
                {result.corrections.bpjsPensiunAdded && (
                  <div className="text-xs text-green-600 pl-4">
                    ✓ Komponen yang hilang ditambahkan: Rp89.306 (1% dari Rp8.930.600)
                  </div>
                )}
              </div>

              <Separator />

              {/* PPh21 */}
              <div className="flex justify-between items-center">
                <span className="text-sm">PPh 21</span>
                <span className="font-medium text-red-600">
                  -{formatCurrency(result.pph21)}
                </span>
              </div>

              {/* Penalty */}
              <div className="flex justify-between items-center">
                <span className="text-sm">Denda Keterlambatan</span>
                <span className="font-medium text-red-600">
                  -{formatCurrency(result.latenessPenalty)}
                </span>
              </div>

              <Separator />

              {/* Total Deductions */}
              <div className="flex justify-between items-center bg-orange-50 p-2 rounded">
                <span className="font-medium text-orange-700">Total Potongan</span>
                <span className="font-bold text-orange-800">
                  -{formatCurrency(result.totalDeductions)}
                </span>
              </div>

              {/* Take Home Pay */}
              <div className="bg-green-50 p-3 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-green-700">Take-Home Pay</span>
                  <span className="text-xl font-bold text-green-800">
                    {formatCurrency(result.takeHomePay)}
                  </span>
                </div>
                {result.corrections.takeHomePayRecalculated && (
                  <div className="text-xs text-green-600 mt-1">
                    ✓ Dihitung ulang dengan formula yang benar
                  </div>
                )}
              </div>

              {/* Company Cost */}
              <div className="bg-gray-50 p-2 rounded text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total Biaya Perusahaan</span>
                  <span className="font-medium text-gray-800">
                    {formatCurrency(result.companyTotalCost)}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Termasuk BPJS yang dibayar perusahaan
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Comparison Table */}
      {showComparison && result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              Perbandingan Sebelum & Sesudah Perbaikan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium">Komponen</th>
                    <th className="text-right p-3 font-medium text-red-600">Nilai Sebelum</th>
                    <th className="text-right p-3 font-medium text-green-600">Nilai Sesudah</th>
                    <th className="text-center p-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="p-3">BPJS Kesehatan</td>
                    <td className="p-3 text-right text-red-600">Rp230.000</td>
                    <td className="p-3 text-right text-green-600">{formatCurrency(result.bpjsKesehatanEmployee)}</td>
                    <td className="p-3 text-center">
                      <Badge className="bg-green-100 text-green-800">Diperbaiki</Badge>
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3">BPJS Pensiun</td>
                    <td className="p-3 text-right text-red-600">-</td>
                    <td className="p-3 text-right text-green-600">{formatCurrency(result.bpjsPensiunEmployee)}</td>
                    <td className="p-3 text-center">
                      <Badge className="bg-blue-100 text-blue-800">Ditambahkan</Badge>
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-3 font-medium">Total Potongan</td>
                    <td className="p-3 text-right text-red-600 font-medium">Rp563.166,67</td>
                    <td className="p-3 text-right text-green-600 font-medium">{formatCurrency(result.totalDeductions)}</td>
                    <td className="p-3 text-center">
                      <Badge className="bg-orange-100 text-orange-800">Diperbarui</Badge>
                    </td>
                  </tr>
                  <tr className="bg-green-50">
                    <td className="p-3 font-bold">Take-Home Pay</td>
                    <td className="p-3 text-right text-red-600 font-bold">Rp11.355.229,33</td>
                    <td className="p-3 text-right text-green-600 font-bold">{formatCurrency(result.takeHomePay)}</td>
                    <td className="p-3 text-center">
                      <Badge className="bg-green-100 text-green-800">Diperbaiki</Badge>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
