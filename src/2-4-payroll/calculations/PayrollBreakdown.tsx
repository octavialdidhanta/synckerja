import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { AlertTriangle, Calculator, TrendingUp } from 'lucide-react';
import { calculatePPh21, formatCurrency } from '@/shared/lib/pph21Calculator';

interface PayrollBreakdownProps {
  employeeData: {
    basicSalary: number;
    transportAllowance: number;
    latenessPenalty: number;
    ptkpStatus: string;
  };
}

export const PayrollBreakdown = ({ employeeData }: PayrollBreakdownProps) => {
  const { basicSalary, transportAllowance, latenessPenalty, ptkpStatus } = employeeData;
  const grossMonthly = basicSalary + transportAllowance;
  
  // Calculate corrected values using PPh21 utility
  const pph21Result = calculatePPh21({
    monthlyGross: grossMonthly,
    ptkpStatus,
    includeBpjsKesehatan: true,
    includeBpjsPensiun: true,
    nonTaxableAllowance: 0
  });

  const bpjsKesehatanEmployee = pph21Result.bpjsKesehatanEmployee / 12;
  const bpjsPensiunEmployee = pph21Result.bpjsPensiunEmployee / 12;
  const totalDeductions = bpjsKesehatanEmployee + bpjsPensiunEmployee + latenessPenalty;
  const netPay = grossMonthly - totalDeductions - pph21Result.monthlyTax;

  // Check if corrections are needed
  const bpjsNeedsCorrection = Math.abs(bpjsKesehatanEmployee - 230000) > 1;
  const pensiunMissing = bpjsPensiunEmployee > 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {/* Deductions Card - Corrected */}
      <Card className="border-l-4 border-l-red-500">
        <CardHeader className="pb-3">
          <CardTitle className="text-red-700 flex items-center gap-2 text-lg">
            DEDUCTIONS
            {(bpjsNeedsCorrection || pensiunMissing) && (
              <Badge variant="secondary" className="bg-orange-100 text-orange-800 text-xs">
                Perlu Koreksi
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600 mb-4">
            {formatCurrency(totalDeductions)}
          </div>
          
          <div className="space-y-3 text-sm">
            <div className="font-medium text-red-700">Detail Komponen:</div>
            
            {/* Lateness Penalty */}
            <div className="flex justify-between items-center">
              <span>Keterlambatan 24/07/2025 - 407 menit</span>
              <span className="font-medium">{formatCurrency(latenessPenalty)}</span>
            </div>
            
            {/* BPJS Kesehatan - Corrected */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span>BPJS Kesehatan</span>
                {bpjsNeedsCorrection && (
                  <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                    Diperbaiki
                  </Badge>
                )}
              </div>
              <span className="font-medium">{formatCurrency(bpjsKesehatanEmployee)}</span>
            </div>
            {bpjsNeedsCorrection && (
              <div className="text-xs text-green-600 pl-4">
                ✓ Dikoreksi dari Rp230.000 → {formatCurrency(bpjsKesehatanEmployee)}
                <br />
                (2% dari min(Rp{grossMonthly.toLocaleString()}, Rp12.000.000))
              </div>
            )}
            
            {/* BPJS Pensiun - Added */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span>BPJS Pensiun</span>
                {pensiunMissing && (
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs">
                    Ditambahkan
                  </Badge>
                )}
              </div>
              <span className="font-medium">{formatCurrency(bpjsPensiunEmployee)}</span>
            </div>
            {pensiunMissing && (
              <div className="text-xs text-blue-600 pl-4">
                ✓ Komponen baru: {formatCurrency(bpjsPensiunEmployee)}
                <br />
                (1% dari min(Rp{grossMonthly.toLocaleString()}, Rp8.930.600))
              </div>
            )}
            
            <div className="border-t pt-2 mt-2">
              <div className="flex justify-between items-center font-medium">
                <span>Detail Keterlambatan:</span>
              </div>
              <div className="text-xs text-gray-600 mt-1">
                Denda Keterlambatan - 24/7/2025<br />
                (407 menit) - {formatCurrency(latenessPenalty)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tax Card - Enhanced with Progressive Breakdown */}
      <Card className="border-l-4 border-l-orange-500">
        <CardHeader className="pb-3">
          <CardTitle className="text-orange-700 flex items-center gap-2 text-lg">
            <Calculator className="h-5 w-5" />
            TAX (PPh 21)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-600 mb-4">
            {formatCurrency(pph21Result.monthlyTax)}
          </div>
          
          <div className="space-y-3 text-sm">
            <div className="font-medium text-orange-700">Detail PPh 21:</div>
            
            <div className="flex justify-between items-center">
              <span>Income Tax</span>
              <span className="font-medium">{formatCurrency(pph21Result.monthlyTax)}</span>
            </div>
            
            {/* Progressive Tax Breakdown */}
            <div className="bg-orange-50 p-3 rounded-lg mt-4">
              <div className="font-medium text-orange-700 mb-2 flex items-center gap-1">
                <TrendingUp className="h-4 w-4" />
                Tarif Progresif:
              </div>
              
              {pph21Result.taxBreakdown.map((bracket, index) => (
                <div key={index} className="flex justify-between items-center text-xs mb-1">
                  <span className="text-orange-600">
                    {bracket.rate}% - {bracket.bracket}
                  </span>
                  <span className="font-medium text-orange-800">
                    {formatCurrency(bracket.tax)}
                  </span>
                </div>
              ))}
              
              <div className="border-t border-orange-200 pt-2 mt-2">
                <div className="text-xs text-orange-600">
                  PKP: {formatCurrency(pph21Result.pkpAmount)}<br />
                  PTKP ({ptkpStatus}): {formatCurrency(pph21Result.ptkpAmount)}
                </div>
              </div>
            </div>
            
            <div className="text-xs text-gray-600 mt-2">
              <div>Gaji Bruto Tahunan: {formatCurrency(pph21Result.annualGross)}</div>
              <div>Biaya Jabatan: {formatCurrency(pph21Result.professionalAllowance)}</div>
              <div>Penghasilan Neto: {formatCurrency(pph21Result.netIncomeBeforeTax)}</div>
              <div>BPJS (Tahunan): {formatCurrency(pph21Result.bpjsKesehatanEmployee + pph21Result.bpjsPensiunEmployee)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Net Pay Card - Corrected */}
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader className="pb-3">
          <CardTitle className="text-blue-700 flex items-center gap-2 text-lg">
            NET PAY
            <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
              Diperbaiki
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600 mb-4">
            {formatCurrency(netPay)}
          </div>
          
          <div className="space-y-2 text-sm">
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="font-medium text-blue-700 mb-2">Perhitungan:</div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span>Gaji Pokok:</span>
                  <span>{formatCurrency(basicSalary)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tunjangan:</span>
                  <span>{formatCurrency(transportAllowance)}</span>
                </div>
                <div className="flex justify-between font-medium border-t pt-1">
                  <span>Gaji Bruto:</span>
                  <span>{formatCurrency(grossMonthly)}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>BPJS Kesehatan:</span>
                  <span>-{formatCurrency(bpjsKesehatanEmployee)}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>BPJS Pensiun:</span>
                  <span>-{formatCurrency(bpjsPensiunEmployee)}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>PPh 21:</span>
                  <span>-{formatCurrency(pph21Result.monthlyTax)}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>Denda:</span>
                  <span>-{formatCurrency(latenessPenalty)}</span>
                </div>
                <div className="flex justify-between font-bold text-blue-700 border-t pt-1">
                  <span>Net Pay:</span>
                  <span>{formatCurrency(netPay)}</span>
                </div>
              </div>
            </div>
            
            {/* Show correction notice */}
            <div className="text-xs text-green-600 bg-green-50 p-2 rounded">
              <div className="flex items-center gap-1 mb-1">
                <AlertTriangle className="h-3 w-3" />
                <span className="font-medium">Perbaikan Otomatis:</span>
              </div>
              <div>• BPJS Kesehatan: Rp230.000 → {formatCurrency(bpjsKesehatanEmployee)}</div>
              <div>• BPJS Pensiun: Ditambahkan {formatCurrency(bpjsPensiunEmployee)}</div>
              <div>• Net Pay: Diperbarui dengan formula yang benar</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
