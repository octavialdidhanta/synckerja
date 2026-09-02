import { buildOrderStoreUrl } from "@/synckerja-order/shared/lib/orderUrls";
import { defaultQrPrintCopy, defaultQrSettingsDraft } from "./qrPrintDefaults";
import type {
  QrCardModel,
  QrTableInput,
  SynckerjaOrderQrSettings,
  SynckerjaOrderQrSettingsDraft,
} from "./qrPrintTypes";

export type BuildQrCardModelInput = {
  publicCode: string;
  table: QrTableInput;
  businessName: string;
  outletName: string;
  logoUrl: string | null;
  settings: SynckerjaOrderQrSettings | SynckerjaOrderQrSettingsDraft;
  locale?: "id" | "en";
};

function resolveText(
  custom: string | null | undefined,
  fallback: string,
): string {
  const trimmed = (custom ?? "").trim();
  return trimmed || fallback;
}

export function mergeQrSettings(
  saved: SynckerjaOrderQrSettings | SynckerjaOrderQrSettingsDraft | null | undefined,
  draft?: Partial<SynckerjaOrderQrSettingsDraft>,
): SynckerjaOrderQrSettingsDraft {
  const base = saved
    ? {
        template_id: saved.template_id,
        headline_text: saved.headline_text,
        subheadline_text: saved.subheadline_text,
        footer_text: saved.footer_text,
        accent_color: saved.accent_color,
        show_logo: saved.show_logo,
        show_outlet_name: saved.show_outlet_name,
        show_table_name: saved.show_table_name,
        show_scan_instruction: saved.show_scan_instruction,
        show_url: saved.show_url,
        paper_size: saved.paper_size,
      }
    : defaultQrSettingsDraft();
  return { ...base, ...draft };
}

export function buildQrCardModel(input: BuildQrCardModelInput): QrCardModel {
  const locale = input.locale ?? "id";
  const defaults = defaultQrPrintCopy(locale);
  const settings = mergeQrSettings(null, input.settings);
  const qrUrl = buildOrderStoreUrl(input.publicCode, {
    mode: "dinein",
    tableNumber: input.table.name,
  });

  return {
    templateId: settings.template_id,
    paperSize: settings.paper_size,
    accentColor: settings.accent_color,
    businessName: input.businessName.trim() || input.outletName,
    outletName: input.outletName.trim(),
    tableLabel: input.table.name.trim(),
    headline: resolveText(settings.headline_text, defaults.headline),
    subheadline: resolveText(settings.subheadline_text, defaults.subheadline),
    footer: resolveText(settings.footer_text, defaults.footer),
    qrUrl,
    logoUrl: input.logoUrl,
    showLogo: settings.show_logo,
    showOutletName: settings.show_outlet_name,
    showTableName: settings.show_table_name,
    showScanInstruction: settings.show_scan_instruction,
    showUrl: settings.show_url,
  };
}
