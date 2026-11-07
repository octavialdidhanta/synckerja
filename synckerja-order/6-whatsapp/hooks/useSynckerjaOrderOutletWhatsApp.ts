import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import type { OrderWhatsAppAccountOption } from "../lib/orderWhatsApp";

export const SYNCKERJA_ORDER_WA_ACCOUNTS_QUERY = "synckerja-order-wa-accounts";
export const SYNCKERJA_ORDER_WA_SETTINGS_QUERY = "synckerja-order-wa-settings";

export type OutletWhatsAppSettings = {
  buttonEnabled: boolean;
  accountId: string | null;
  prefillMessage: string;
};

export type OutletWhatsAppPatch = Partial<OutletWhatsAppSettings>;

export const DEFAULT_OUTLET_WHATSAPP_SETTINGS: OutletWhatsAppSettings = {
  buttonEnabled: true,
  accountId: null,
  prefillMessage: "",
};

type SettingsMap = Record<string, OutletWhatsAppSettings>;

/**
 * Backoffice: omnichannel WhatsApp accounts of the active org + per-outlet button settings.
 * Only non-secret columns are selected (never tokens).
 */
export function useSynckerjaOrderOutletWhatsApp() {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const settingsKey = [SYNCKERJA_ORDER_WA_SETTINGS_QUERY, organizationId];

  const accounts = useQuery({
    queryKey: [SYNCKERJA_ORDER_WA_ACCOUNTS_QUERY, organizationId],
    queryFn: async (): Promise<OrderWhatsAppAccountOption[]> => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("organization_whatsapp_accounts")
        .select("id, whatsapp_business_name, display_phone_number")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: String(row.id),
        businessName: row.whatsapp_business_name ? String(row.whatsapp_business_name) : null,
        displayPhoneNumber: row.display_phone_number ? String(row.display_phone_number) : null,
      }));
    },
    enabled: Boolean(organizationId),
  });

  const settings = useQuery({
    queryKey: settingsKey,
    queryFn: async (): Promise<SettingsMap> => {
      if (!organizationId) return {};
      const { data, error } = await supabase
        .from("synckerja_order_outlet_settings")
        .select("outlet_id, whatsapp_button_enabled, whatsapp_account_id, whatsapp_prefill_message")
        .eq("organization_id", organizationId);
      if (error) throw error;
      const map: SettingsMap = {};
      for (const row of data ?? []) {
        map[String(row.outlet_id)] = {
          buttonEnabled: row.whatsapp_button_enabled !== false,
          accountId: row.whatsapp_account_id ? String(row.whatsapp_account_id) : null,
          prefillMessage: String(row.whatsapp_prefill_message ?? ""),
        };
      }
      return map;
    },
    enabled: Boolean(organizationId),
  });

  const save = useMutation({
    mutationFn: async (args: { outletId: string; patch: OutletWhatsAppPatch }) => {
      if (!organizationId) throw new Error("Organization ID is required");
      const row: Record<string, unknown> = {
        organization_id: organizationId,
        outlet_id: args.outletId,
      };
      if (args.patch.buttonEnabled !== undefined) row.whatsapp_button_enabled = args.patch.buttonEnabled;
      if (args.patch.accountId !== undefined) row.whatsapp_account_id = args.patch.accountId;
      if (args.patch.prefillMessage !== undefined) {
        row.whatsapp_prefill_message = args.patch.prefillMessage.trim() || null;
      }
      // Upsert touches only the columns above; a new row keeps `enabled` at its default (false).
      const { error } = await supabase
        .from("synckerja_order_outlet_settings")
        .upsert(row, { onConflict: "outlet_id" });
      if (error) throw error;
    },
    onMutate: async ({ outletId, patch }) => {
      await queryClient.cancelQueries({ queryKey: settingsKey });
      const previous = queryClient.getQueryData<SettingsMap>(settingsKey);
      queryClient.setQueryData<SettingsMap>(settingsKey, (old) => ({
        ...(old ?? {}),
        [outletId]: { ...DEFAULT_OUTLET_WHATSAPP_SETTINGS, ...(old?.[outletId] ?? {}), ...patch },
      }));
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(settingsKey, ctx.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: settingsKey });
    },
  });

  const settingsFor = (outletId: string): OutletWhatsAppSettings =>
    settings.data?.[outletId] ?? DEFAULT_OUTLET_WHATSAPP_SETTINGS;

  return {
    accounts: accounts.data ?? [],
    settingsFor,
    save,
    isLoading: accounts.isLoading || settings.isLoading,
    isError: accounts.isError || settings.isError,
  };
}
