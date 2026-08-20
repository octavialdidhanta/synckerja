import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import type {
  CatalogCheckoutApplicationMethod,
  CatalogCheckoutSettings,
  CatalogCheckoutSettingsSave,
} from "../types";

export const CATALOG_CHECKOUT_SETTINGS_QUERY_KEY = "catalog-checkout-settings";

const SELECT_COLUMNS = "organization_id, tax_enabled, gratuity_enabled, application_method";

const DEFAULT_SETTINGS: Omit<CatalogCheckoutSettings, "organization_id"> = {
  tax_enabled: false,
  gratuity_enabled: false,
  application_method: "add",
};

function mapApplicationMethod(value: unknown): CatalogCheckoutApplicationMethod {
  return value === "include" ? "include" : "add";
}

function mapRow(row: {
  organization_id: string;
  tax_enabled: boolean;
  gratuity_enabled: boolean;
  application_method: string;
}): CatalogCheckoutSettings {
  return {
    organization_id: row.organization_id,
    tax_enabled: Boolean(row.tax_enabled),
    gratuity_enabled: Boolean(row.gratuity_enabled),
    application_method: mapApplicationMethod(row.application_method),
  };
}

async function fetchOrCreateSettings(organizationId: string): Promise<CatalogCheckoutSettings> {
  const { data, error } = await supabase
    .from("catalog_checkout_settings")
    .select(SELECT_COLUMNS)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw error;
  if (data) return mapRow(data as CatalogCheckoutSettings);

  const { data: inserted, error: insertError } = await supabase
    .from("catalog_checkout_settings")
    .insert({
      organization_id: organizationId,
      ...DEFAULT_SETTINGS,
    })
    .select(SELECT_COLUMNS)
    .single();

  if (!insertError && inserted) return mapRow(inserted as CatalogCheckoutSettings);

  const { data: existing, error: refetchError } = await supabase
    .from("catalog_checkout_settings")
    .select(SELECT_COLUMNS)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (refetchError) throw insertError ?? refetchError;
  if (existing) return mapRow(existing as CatalogCheckoutSettings);
  throw insertError ?? new Error("checkout_settings_missing");
}

export function useCatalogCheckoutSettings() {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [CATALOG_CHECKOUT_SETTINGS_QUERY_KEY, organizationId],
    queryFn: async (): Promise<CatalogCheckoutSettings | null> => {
      if (!organizationId) return null;
      return fetchOrCreateSettings(organizationId);
    },
    enabled: !!organizationId,
  });

  const save = useMutation({
    mutationFn: async (payload: CatalogCheckoutSettingsSave) => {
      if (!organizationId) throw new Error("Organization ID is required");
      const row = {
        organization_id: organizationId,
        tax_enabled: payload.tax_enabled,
        gratuity_enabled: payload.gratuity_enabled,
        application_method: payload.application_method === "include" ? "include" : "add",
      };
      const { error } = await supabase
        .from("catalog_checkout_settings")
        .upsert(row, { onConflict: "organization_id", ignoreDuplicates: false });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [CATALOG_CHECKOUT_SETTINGS_QUERY_KEY, organizationId],
      });
    },
  });

  return {
    settings: query.data ?? null,
    isLoading: query.isLoading,
    save: save.mutateAsync,
    isSaving: save.isPending,
  };
}
