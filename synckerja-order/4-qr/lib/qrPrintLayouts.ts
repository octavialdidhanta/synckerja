import type { QrPrintPaperSize, QrPrintTemplateId } from "./qrPrintTypes";

export function qrCodeSizeForTemplate(templateId: QrPrintTemplateId, forPrint: boolean): number {
  if (forPrint) {
    switch (templateId) {
      case "minimal":
        return 200;
      case "tent":
        return 180;
      default:
        return 220;
    }
  }
  switch (templateId) {
    case "minimal":
      return 160;
    case "tent":
      return 140;
    default:
      return 180;
  }
}

export function paperSizeClass(paperSize: QrPrintPaperSize): string {
  return paperSize === "a5" ? "qr-print-page--a5" : "qr-print-page--a4";
}

export function templateClass(templateId: QrPrintTemplateId): string {
  return `qr-table-card--${templateId}`;
}
