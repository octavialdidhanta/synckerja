import type { jsPDF } from "jspdf";
import { loadPdfKit } from "@/shared/lib/pdf/loadPdfKit";
import * as XLSX from "xlsx";
import type { CalculatePPh21Result } from "./pph21Calculator";
import { formatCurrency } from "./pph21Calculator";

type JsPdfWithAutoTable = jsPDF & { lastAutoTable?: { finalY: number } };

function afterTableY(doc: jsPDF, fallback: number): number {
  const d = doc as JsPdfWithAutoTable;
  return (d.lastAutoTable?.finalY ?? fallback) + 8;
}

export type PPh21ExportPayload = {
  mode: "gross-to-net" | "net-to-gross";
  salaryInput: string;
  ptkpStatus: string;
  customPtkp: string;
  bpjsKesehatan: boolean;
  bpjsPensiun: boolean;
  nonTaxableAllowance: string;
  salaryIncrease: string;
  result: CalculatePPh21Result;
  increaseResult: CalculatePPh21Result | null;
  generatedAt: Date;
};

function fileStamp(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function modeLabel(mode: PPh21ExportPayload["mode"]): string {
  return mode === "gross-to-net" ? "Gaji Bruto → Take-Home Pay" : "Take-Home Pay → Gaji Bruto";
}

export async function exportPPh21ToPdf(payload: PPh21ExportPayload): Promise<void> {
  const { jsPDF: JsPDF, autoTable } = await loadPdfKit({ withAutoTable: true });
  if (!autoTable) {
    throw new Error("jspdf-autotable failed to load");
  }
  const { result, increaseResult, generatedAt } = payload;
  const doc = new JsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 14;

  doc.setFontSize(14);
  doc.text("Ringkasan PPh 21", 14, y);
  y += 6;
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text(`Dicetak: ${generatedAt.toLocaleString("id-ID")}`, 14, y);
  doc.setTextColor(0, 0, 0);
  y += 8;

  const paramRows: (string | number)[][] = [
    ["Mode", modeLabel(payload.mode)],
    ["Input gaji / THP (per bulan)", payload.salaryInput],
    ["Status PTKP", payload.ptkpStatus === "custom" ? `Custom (${payload.customPtkp})` : payload.ptkpStatus],
    ["BPJS Kesehatan", payload.bpjsKesehatan ? "Ya" : "Tidak"],
    ["BPJS Pensiun", payload.bpjsPensiun ? "Ya" : "Tidak"],
    ["Tunjangan tidak kena pajak", payload.nonTaxableAllowance],
    ["Simulasi kenaikan (%)", payload.salaryIncrease],
  ];

  autoTable(doc, {
    startY: y,
    head: [["Parameter", "Nilai"]],
    body: paramRows,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [37, 99, 235] },
    margin: { left: 14, right: 14 },
  });

  y = afterTableY(doc, y + 40);

  const summaryRows: (string | number)[][] = [
    ["Gaji setahun", formatCurrency(result.annualGross)],
    ["Biaya jabatan (max 5%)", formatCurrency(result.professionalAllowance)],
    ["BPJS Kesehatan (tahunan)", formatCurrency(result.bpjsKesehatan)],
    ["BPJS Pensiun (tahunan)", formatCurrency(result.bpjsPensiun)],
    ["Penghasilan neto", formatCurrency(result.netIncome)],
    ["PTKP", formatCurrency(result.ptkp)],
    ["PKP", formatCurrency(result.pkp)],
    ["PPh 21 setahun", formatCurrency(result.annualTax)],
    ["PPh 21 per bulan", formatCurrency(result.monthlyTax)],
    ["Take-home pay / bulan", formatCurrency(result.takeHomePay)],
    ["Total biaya perusahaan / bulan", formatCurrency(result.totalCompanyCost)],
  ];

  autoTable(doc, {
    startY: y,
    head: [["Hasil utama", ""]],
    body: summaryRows,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [37, 99, 235] },
    margin: { left: 14, right: 14 },
  });

  y = afterTableY(doc, y + 50);

  if (result.pkp > 0 && result.taxBreakdown.length > 0) {
    if (y > 250) {
      doc.addPage();
      y = 14;
    }
    const breakdownBody = result.taxBreakdown.map((row) => [
      row.bracket,
      `${row.rate.toFixed(0)}%`,
      formatCurrency(row.amount),
      formatCurrency(row.tax),
    ]);
    autoTable(doc, {
      startY: y,
      head: [["Lapisan PKP", "Tarif", "Dasar", "Pajak"]],
      body: breakdownBody,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [37, 99, 235] },
      margin: { left: 14, right: 14 },
    });
    y = afterTableY(doc, y + 40) - 2;
    doc.setFontSize(8);
    doc.text(`Total PPh 21 tahunan: ${formatCurrency(result.annualTax)}`, 14, y);
    y += 8;
  }

  if (increaseResult) {
    if (y > 240) {
      doc.addPage();
      y = 14;
    }
    const simRows: (string | number)[][] = [
      ["Gaji baru / bulan", formatCurrency(increaseResult.annualGross / 12)],
      ["PPh 21 baru / bulan", formatCurrency(increaseResult.monthlyTax)],
      ["Take-home pay baru", formatCurrency(increaseResult.takeHomePay)],
      ["Selisih PPh 21 / bulan", formatCurrency(increaseResult.monthlyTax - result.monthlyTax)],
      ["Selisih take-home / bulan", formatCurrency(increaseResult.takeHomePay - result.takeHomePay)],
    ];
    autoTable(doc, {
      startY: y,
      head: [[`Simulasi kenaikan gaji ${payload.salaryIncrease}%`, ""]],
      body: simRows,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [99, 102, 241] },
      margin: { left: 14, right: 14 },
    });
  }

  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  const pageH = doc.internal.pageSize.getHeight();
  doc.text(
    "Simulasi sesuai referensi UU PPh Pasal 17 — bukan pengganti konsultan pajak.",
    pageW / 2,
    pageH - 8,
    { align: "center" },
  );

  doc.save(`pph21-perhitungan-${fileStamp(generatedAt)}.pdf`);
}

export function exportPPh21ToExcel(payload: PPh21ExportPayload): void {
  const { result, increaseResult, generatedAt } = payload;
  const wb = XLSX.utils.book_new();

  const paramSheet = XLSX.utils.aoa_to_sheet([
    ["Parameter", "Nilai"],
    ["Mode", modeLabel(payload.mode)],
    ["Input", payload.salaryInput],
    ["PTKP", payload.ptkpStatus === "custom" ? `Custom (${payload.customPtkp})` : payload.ptkpStatus],
    ["BPJS Kesehatan", payload.bpjsKesehatan ? "Ya" : "Tidak"],
    ["BPJS Pensiun", payload.bpjsPensiun ? "Ya" : "Tidak"],
    ["Tunjangan tidak kena pajak", payload.nonTaxableAllowance],
    ["Simulasi kenaikan (%)", payload.salaryIncrease],
    ["Dicetak", generatedAt.toISOString()],
  ]);
  XLSX.utils.book_append_sheet(wb, paramSheet, "Parameter");

  const summary = XLSX.utils.aoa_to_sheet([
    ["Ringkasan", "Nilai"],
    ["Gaji setahun", result.annualGross],
    ["Biaya jabatan", result.professionalAllowance],
    ["BPJS Kesehatan (thn)", result.bpjsKesehatan],
    ["BPJS Pensiun (thn)", result.bpjsPensiun],
    ["Penghasilan neto", result.netIncome],
    ["PTKP", result.ptkp],
    ["PKP", result.pkp],
    ["PPh 21 tahunan", result.annualTax],
    ["PPh 21 bulanan", result.monthlyTax],
    ["Take-home / bulan", result.takeHomePay],
    ["Biaya perusahaan / bulan", result.totalCompanyCost],
  ]);
  XLSX.utils.book_append_sheet(wb, summary, "Ringkasan");

  const breakdownData: (string | number)[][] = [
    ["Lapisan", "Tarif %", "Dasar", "Pajak"],
    ...result.taxBreakdown.map((r) => [r.bracket, r.rate, r.amount, r.tax]),
  ];
  const breakdownSheet = XLSX.utils.aoa_to_sheet(breakdownData);
  XLSX.utils.book_append_sheet(wb, breakdownSheet, "TarifProgresif");

  if (increaseResult) {
    const sim = XLSX.utils.aoa_to_sheet([
      ["Simulasi kenaikan", ""],
      ["Gaji baru / bln", increaseResult.annualGross / 12],
      ["PPh baru / bln", increaseResult.monthlyTax],
      ["THP baru", increaseResult.takeHomePay],
      ["Selisih PPh", increaseResult.monthlyTax - result.monthlyTax],
      ["Selisih THP", increaseResult.takeHomePay - result.takeHomePay],
    ]);
    XLSX.utils.book_append_sheet(wb, sim, "Simulasi");
  }

  XLSX.writeFile(wb, `pph21-perhitungan-${fileStamp(generatedAt)}.xlsx`);
}
