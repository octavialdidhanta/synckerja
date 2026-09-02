import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import { defaultQrSettingsDraft } from "../lib/qrPrintDefaults";
import type {
  QrPrintPaperSize,
  QrPrintTemplateId,
  SynckerjaOrderQrSettings,
  SynckerjaOrderQrSettingsDraft,
} from "../lib/qrPrintTypes";

export const SYNCKERJA_ORDER_QR_SETTINGS_QUERY = "synckerja-order-qr-settings";

function mapRow(row: Record<string, unknown>): SynckerjaOrderQrSettings {
  return {
    organization_id: String(row.organization_id),
    outlet_id: String(row.outlet_id),
    template_id: (row.template_id as QrPrintTemplateId) ?? "classic",
    headline_text: row.headline_text ? String(row.headline_text) : null,
    subheadline_text: row.subheadline_text ? String(row.subheadline_text) : null,
    footer_text: row.footer_text ? String(row.footer_text) : null,
    accent_color: String(row.accent_color ?? "#2563eb"),
    show_logo: Boolean(row.show_logo),
    show_outlet_name: Boolean(row.show_outlet_name),
    show_table_name: Boolean(row.show_table_name),
    show_scan_instruction: Boolean(row.show_scan_instruction),
    show_url: Boolean(row.show_url),
    paper_size: (row.paper_size as QrPrintPaperSize) ?? "a4",
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
  };
}

export function useSynckerjaOrderQrSettings(outletId: string | null) {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [SYNCKERJA_ORDER_QR_SETTINGS_QUERY, organizationId, outletId],
    queryFn: async (): Promise<SynckerjaOrderQrSettings | null> => {
      if (!organizationId || !outletId) return null;
      const { data, error } = await supabase
        .from("synckerja_order_qr_settings")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("outlet_id", outletId)
        .maybeSingle();
      if (error) throw error;
      return data ? mapRow(data as Record<string, unknown>) : null;
    },
    enabled: Boolean(organizationId && outletId),
  });

  const save = useMutation({
    mutationFn: async (draft: SynckerjaOrderQrSettingsDraft) => {
      if (!organizationId || !outletId) throw new Error("Organization ID is required");
      const { error } = await supabase.from("synckerja_order_qr_settings").upsert(
        {
          organization_id: organizationId,
          outlet_id: outletId,
          template_id: draft.template_id,
          headline_text: draft.headline_text,
          subheadline_text: draft.subheadline_text,
          footer_text: draft.footer_text,
          accent_color: draft.accent_color,
          show_logo: draft.show_logo,
          show_outlet_name: draft.show_outlet_name,
          show_table_name: draft.show_table_name,
          show_scan_instruction: draft.show_scan_instruction,
          show_url: draft.show_url,
          paper_size: draft.paper_size,
        },
        { onConflict: "organization_id,outlet_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [SYNCKERJA_ORDER_QR_SETTINGS_QUERY, organizationId, outletId],
      });
    },
  });

  const settings = useMemo((): SynckerjaOrderQrSettingsDraft => {
    const row = query.data;
    if (!row) return defaultQrSettingsDraft();
    return {
      template_id: row.template_id,
      headline_text: row.headline_text,
      subheadline_text: row.subheadline_text,
      footer_text: row.footer_text,
      accent_color: row.accent_color,
      show_logo: row.show_logo,
      show_outlet_name: row.show_outlet_name,
      show_table_name: row.show_table_name,
      show_scan_instruction: row.show_scan_instruction,
      show_url: row.show_url,
      paper_size: row.paper_size,
    };
  }, [query.data]);

  return {
    ...query,
    settings,
    saved: query.data,
    save,
  };
}
