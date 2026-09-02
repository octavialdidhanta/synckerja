import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import type { SynckerjaOrderOrgSettings } from "@/synckerja-order/shared/lib/orderTypes";

export const SYNCKERJA_ORDER_ORG_QUERY = "synckerja-order-org";

const EMPTY: SynckerjaOrderOrgSettings = {
  organization_id: "",
  terms_accepted_at: null,
  terms_version: null,
  business_name: "",
  logo_path: null,
  cover_path: null,
  contact_phone: null,
  contact_email: null,
  contact_whatsapp: null,
  contact_instagram: null,
  terms_html: null,
  pickup_enabled: false,
};

export function useSynckerjaOrderOrgSettings() {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [SYNCKERJA_ORDER_ORG_QUERY, organizationId],
    queryFn: async (): Promise<SynckerjaOrderOrgSettings> => {
      if (!organizationId) return EMPTY;
      const { data, error } = await supabase
        .from("synckerja_order_org_settings")
        .select(
          "organization_id, terms_accepted_at, terms_version, business_name, logo_path, cover_path, contact_phone, contact_email, contact_whatsapp, contact_instagram, terms_html, pickup_enabled, updated_at",
        )
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return { ...EMPTY, organization_id: organizationId };
      return data as SynckerjaOrderOrgSettings;
    },
    enabled: Boolean(organizationId),
  });

  const save = useMutation({
    mutationFn: async (patch: Partial<SynckerjaOrderOrgSettings>) => {
      if (!organizationId) throw new Error("Organization ID is required");
      const row = {
        organization_id: organizationId,
        business_name: patch.business_name ?? query.data?.business_name ?? "",
        logo_path: patch.logo_path === undefined ? query.data?.logo_path ?? null : patch.logo_path,
        cover_path: patch.cover_path === undefined ? query.data?.cover_path ?? null : patch.cover_path,
        contact_phone: patch.contact_phone === undefined ? query.data?.contact_phone ?? null : patch.contact_phone,
        contact_email: patch.contact_email === undefined ? query.data?.contact_email ?? null : patch.contact_email,
        contact_whatsapp:
          patch.contact_whatsapp === undefined ? query.data?.contact_whatsapp ?? null : patch.contact_whatsapp,
        contact_instagram:
          patch.contact_instagram === undefined ? query.data?.contact_instagram ?? null : patch.contact_instagram,
        terms_html: patch.terms_html === undefined ? query.data?.terms_html ?? null : patch.terms_html,
        pickup_enabled:
          patch.pickup_enabled === undefined ? query.data?.pickup_enabled ?? false : patch.pickup_enabled,
        terms_accepted_at:
          patch.terms_accepted_at === undefined
            ? query.data?.terms_accepted_at ?? null
            : patch.terms_accepted_at,
        terms_version:
          patch.terms_version === undefined ? query.data?.terms_version ?? null : patch.terms_version,
      };
      const { error } = await supabase.from("synckerja_order_org_settings").upsert(row, {
        onConflict: "organization_id",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [SYNCKERJA_ORDER_ORG_QUERY, organizationId] });
    },
  });

  return { ...query, settings: query.data ?? EMPTY, save };
}
