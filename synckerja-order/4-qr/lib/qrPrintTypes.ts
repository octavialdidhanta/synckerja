export const QR_PRINT_TEMPLATES = ["classic", "minimal", "tent"] as const;
export type QrPrintTemplateId = (typeof QR_PRINT_TEMPLATES)[number];

export const QR_PRINT_PAPER_SIZES = ["a4", "a5"] as const;
export type QrPrintPaperSize = (typeof QR_PRINT_PAPER_SIZES)[number];

export type SynckerjaOrderQrSettings = {
  organization_id: string;
  outlet_id: string;
  template_id: QrPrintTemplateId;
  headline_text: string | null;
  subheadline_text: string | null;
  footer_text: string | null;
  accent_color: string;
  show_logo: boolean;
  show_outlet_name: boolean;
  show_table_name: boolean;
  show_scan_instruction: boolean;
  show_url: boolean;
  paper_size: QrPrintPaperSize;
  updated_at?: string;
};

export type SynckerjaOrderQrSettingsDraft = Omit<
  SynckerjaOrderQrSettings,
  "organization_id" | "outlet_id" | "updated_at"
>;

export type QrTableInput = {
  id: string;
  name: string;
  group_name?: string | null;
};

export type QrCardModel = {
  templateId: QrPrintTemplateId;
  paperSize: QrPrintPaperSize;
  accentColor: string;
  businessName: string;
  outletName: string;
  tableLabel: string;
  headline: string;
  subheadline: string;
  footer: string;
  qrUrl: string;
  logoUrl: string | null;
  showLogo: boolean;
  showOutletName: boolean;
  showTableName: boolean;
  showScanInstruction: boolean;
  showUrl: boolean;
};
