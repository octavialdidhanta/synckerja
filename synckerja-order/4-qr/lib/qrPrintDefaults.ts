import type { QrPrintTemplateId, SynckerjaOrderQrSettingsDraft } from "./qrPrintTypes";

export const DEFAULT_QR_ACCENT_COLOR = "#2563eb";

export type QrPrintDefaultCopy = {
  headline: string;
  subheadline: string;
  footer: string;
};

export function defaultQrPrintCopy(locale: "id" | "en" = "id"): QrPrintDefaultCopy {
  if (locale === "en") {
    return {
      headline: "Scan to order",
      subheadline: "Open your camera and scan the QR code",
      footer: "Powered by Synckerja Order",
    };
  }
  return {
    headline: "Scan untuk pesan",
    subheadline: "Buka kamera HP Anda lalu scan kode QR",
    footer: "Powered by Synckerja Order",
  };
}

export function defaultQrSettingsDraft(): SynckerjaOrderQrSettingsDraft {
  return {
    template_id: "classic",
    headline_text: null,
    subheadline_text: null,
    footer_text: null,
    accent_color: DEFAULT_QR_ACCENT_COLOR,
    show_logo: true,
    show_outlet_name: true,
    show_table_name: true,
    show_scan_instruction: true,
    show_url: false,
    paper_size: "a4",
  };
}

export function templateLabelKey(templateId: QrPrintTemplateId): string {
  switch (templateId) {
    case "minimal":
      return "synckerjaOrder.qr.template.minimal";
    case "tent":
      return "synckerjaOrder.qr.template.tent";
    default:
      return "synckerjaOrder.qr.template.classic";
  }
}
