import type jsPDF from "jspdf";
import { loadPdfKit } from "@/shared/lib/pdf/loadPdfKit";
import { formatCurrency } from "@/shared/lib/pph21Calculator";

export interface PayslipLineItem {
  item_name: string;
  item_type: string;
  item_category?: string;
  calculated_amount: number;
}

export interface PayslipData {
  companyName: string;
  companyAddress?: string | null;
  employeeName: string;
  employeeCode?: string | null;
  npwp?: string | null;
  ptkpStatus?: string | null;
  periodName: string;
  payDate?: string | null;
  basicSalary: number;
  takeHomePay: number;
  grossPay: number;
  calculationMode?: string | null;
  lineItems: PayslipLineItem[];
  payoutSnapshot?: {
    bank_name?: string | null;
    account_number?: string | null;
    account_holder?: string | null;
  } | null;
}

export class PayslipPDFGenerator {
  private doc: jsPDF;
  private margin = 20;
  private pageWidth: number;
  private y: number;

  private constructor(doc: jsPDF) {
    this.doc = doc;
    this.pageWidth = doc.internal.pageSize.getWidth();
    this.y = this.margin;
  }

  static async create(): Promise<PayslipPDFGenerator> {
    const { jsPDF: JsPDF } = await loadPdfKit({ autotable: true });
    return new PayslipPDFGenerator(new JsPDF());
  }

  private row(label: string, value: string, bold = false) {
    this.doc.setFont("helvetica", bold ? "bold" : "normal");
    this.doc.setFontSize(10);
    this.doc.text(label, this.margin, this.y);
    this.doc.text(value, this.pageWidth - this.margin, this.y, { align: "right" });
    this.y += 6;
  }

  generate(data: PayslipData): jsPDF {
    this.doc.setFontSize(14);
    this.doc.setFont("helvetica", "bold");
    this.doc.text("SLIP GAJI", this.pageWidth / 2, this.y, { align: "center" });
    this.y += 8;
    this.doc.setFontSize(11);
    this.doc.text(data.companyName, this.pageWidth / 2, this.y, { align: "center" });
    this.y += 10;

    this.doc.setFontSize(9);
    this.doc.setFont("helvetica", "normal");
    this.row("Karyawan", data.employeeName);
    if (data.employeeCode) this.row("ID Karyawan", data.employeeCode);
    if (data.npwp) this.row("NPWP", data.npwp);
    if (data.ptkpStatus) this.row("PTKP", data.ptkpStatus);
    this.row("Periode", data.periodName);
    if (data.payDate) this.row("Tanggal Bayar", data.payDate);
    if (data.calculationMode) this.row("Metode Pajak", data.calculationMode.toUpperCase());
    this.y += 4;

    const allowances = data.lineItems.filter((i) => i.item_type === "allowance");
    const deductions = data.lineItems.filter(
      (i) => i.item_type === "deduction" || i.item_type === "tax",
    );

    this.doc.setFont("helvetica", "bold");
    this.doc.text("Pendapatan", this.margin, this.y);
    this.y += 6;
    this.doc.setFont("helvetica", "normal");
    this.row("Gaji Pokok", formatCurrency(data.basicSalary));
    for (const item of allowances) {
      this.row(item.item_name, formatCurrency(item.calculated_amount));
    }
    this.row("Total Bruto", formatCurrency(data.grossPay), true);
    this.y += 4;

    this.doc.setFont("helvetica", "bold");
    this.doc.text("Potongan", this.margin, this.y);
    this.y += 6;
    this.doc.setFont("helvetica", "normal");
    for (const item of deductions) {
      this.row(item.item_name, `- ${formatCurrency(item.calculated_amount)}`);
    }
    this.y += 4;
    this.row("TAKE HOME PAY", formatCurrency(data.takeHomePay), true);

    if (data.payoutSnapshot?.account_number) {
      this.y += 8;
      this.doc.setFont("helvetica", "bold");
      this.doc.text("Rekening Tujuan", this.margin, this.y);
      this.y += 6;
      this.doc.setFont("helvetica", "normal");
      this.row("Bank", data.payoutSnapshot.bank_name ?? "-");
      this.row("No. Rekening", data.payoutSnapshot.account_number ?? "-");
      this.row("Atas Nama", data.payoutSnapshot.account_holder ?? "-");
    }

    this.y += 12;
    this.doc.setFontSize(8);
    this.doc.setTextColor(120, 120, 120);
    this.doc.text(
      "Dokumen elektronik Synckerja — bukan bukti transfer bank.",
      this.pageWidth / 2,
      this.y,
      { align: "center" },
    );
    this.doc.setTextColor(0, 0, 0);

    return this.doc;
  }

  async download(data: PayslipData, filename: string) {
    this.generate(data);
    this.doc.save(filename);
  }
}
