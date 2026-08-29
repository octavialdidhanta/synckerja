import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { POS_OUTLETS_QUERY_KEY } from "@/8-2-2-outlets/hooks/usePosOutlets";
import type { PosOutletReceiptSettings, PosOutletReceiptSettingsSave, ReceiptOutletIdentitySave } from "../types";
import { EMPTY_RECEIPT_SETTINGS, RECEIPT_SETTINGS_SELECT } from "../types";
import { removeOutletReceiptLogo, uploadOutletReceiptLogo } from "../lib/receiptLogoStorage";

export const POS_OUTLET_RECEIPT_SETTINGS_QUERY_KEY = "pos-outlet-receipt-settings";

function mapRow(row: PosOutletReceiptSettings): PosOutletReceiptSettings {
  return {
    id: row.id,
    organization_id: row.organization_id,
    outlet_id: row.outlet_id,
    logo_storage_path: row.logo_storage_path ?? null,
    footer_notes: row.footer_notes ?? null,
    share_via_email: Boolean(row.share_via_email),
    share_via_sms: Boolean(row.share_via_sms),
    website_url: row.website_url ?? null,
    twitter_url: row.twitter_url ?? null,
    facebook_url: row.facebook_url ?? null,
    instagram_url: row.instagram_url ?? null,
    tiktok_url: row.tiktok_url ?? null,
    whatsapp_url: row.whatsapp_url ?? null,
  };
}

export function useOutletReceiptSettings(outletId: string | null) {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [POS_OUTLET_RECEIPT_SETTINGS_QUERY_KEY, organizationId, outletId],
    queryFn: async (): Promise<PosOutletReceiptSettings | null> => {
      if (!organizationId || !outletId) return null;
      const { data, error } = await supabase
        .from("pos_outlet_receipt_settings")
        .select(RECEIPT_SETTINGS_SELECT)
        .eq("organization_id", organizationId)
        .eq("outlet_id", outletId)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        return {
          id: "",
          organization_id: organizationId,
          outlet_id: outletId,
          ...EMPTY_RECEIPT_SETTINGS,
        };
      }
      return mapRow(data as PosOutletReceiptSettings);
    },
    enabled: Boolean(organizationId && outletId),
  });

  const save = useMutation({
    mutationFn: async (payload: {
      identity: ReceiptOutletIdentitySave;
      businessName: string;
      settings: PosOutletReceiptSettingsSave;
      logoFile: File | null;
      removeLogo: boolean;
    }) => {
      if (!organizationId || !outletId) throw new Error("Organization ID is required");
      const companyName = payload.businessName.trim();
      if (!companyName) throw new Error("receipt_business_name_required");
      const outletName = payload.identity.name.trim();
      if (!outletName) throw new Error("receipt_outlet_name_required");

      const { error: outletError } = await supabase
        .from("pos_outlets")
        .update({
          name: outletName,
          city: payload.identity.city,
          province: payload.identity.province,
          postal_code: payload.identity.postal_code,
          phone: payload.identity.phone,
        })
        .eq("id", outletId)
        .eq("organization_id", organizationId);
      if (outletError) throw outletError;

      const { error: orgError } = await supabase
        .from("organizations")
        .update({ company_name: companyName, updated_at: new Date().toISOString() })
        .eq("id", organizationId);
      if (orgError) throw orgError;

      let logoPath = payload.settings.logo_storage_path;
      if (payload.logoFile) {
        logoPath = await uploadOutletReceiptLogo({
          organizationId,
          outletId,
          file: payload.logoFile,
        });
      } else if (payload.removeLogo) {
        if (payload.settings.logo_storage_path) {
          await removeOutletReceiptLogo(payload.settings.logo_storage_path);
        }
        logoPath = null;
      }

      const row = {
        organization_id: organizationId,
        outlet_id: outletId,
        logo_storage_path: logoPath,
        footer_notes: payload.settings.footer_notes,
        share_via_email: payload.settings.share_via_email,
        share_via_sms: payload.settings.share_via_sms,
        website_url: payload.settings.website_url,
        twitter_url: payload.settings.twitter_url,
        facebook_url: payload.settings.facebook_url,
        instagram_url: payload.settings.instagram_url,
        tiktok_url: payload.settings.tiktok_url,
        whatsapp_url: payload.settings.whatsapp_url,
      };

      const { error: upsertError } = await supabase
        .from("pos_outlet_receipt_settings")
        .upsert(row, { onConflict: "outlet_id", ignoreDuplicates: false });
      if (upsertError) throw upsertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [POS_OUTLET_RECEIPT_SETTINGS_QUERY_KEY, organizationId] });
      queryClient.invalidateQueries({ queryKey: [POS_OUTLETS_QUERY_KEY, organizationId] });
      queryClient.invalidateQueries({ queryKey: ["company-profile", organizationId] });
    },
  });

  return {
    settings: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    save: save.mutateAsync,
    isSaving: save.isPending,
  };
}
