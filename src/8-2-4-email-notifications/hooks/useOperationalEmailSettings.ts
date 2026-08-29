import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import type {
  OperationalEmailNotificationSettings,
  OperationalEmailNotificationSettingsSave,
} from "../types";
import { DEFAULT_OPERATIONAL_EMAIL_SETTINGS } from "../types";

export const OPERATIONAL_EMAIL_SETTINGS_QUERY_KEY = "operational-email-notification-settings";

/** Settings change rarely; avoid refetch on every navigation to this page. */
const OPERATIONAL_EMAIL_SETTINGS_STALE_MS = 5 * 60_000;

function mapSettingsRow(row: {
  organization_id: string;
  daily_sales_summary_enabled: boolean;
  inventory_alerts_enabled: boolean;
  promo_update_enabled: boolean;
  daily_gross_profit_enabled?: boolean;
  shift_recap_email_enabled?: boolean;
}): OperationalEmailNotificationSettings {
  return {
    organization_id: row.organization_id,
    daily_sales_summary_enabled: Boolean(row.daily_sales_summary_enabled),
    inventory_alerts_enabled: Boolean(row.inventory_alerts_enabled),
    promo_update_enabled: Boolean(row.promo_update_enabled),
    daily_gross_profit_enabled: row.daily_gross_profit_enabled !== false,
    shift_recap_email_enabled: row.shift_recap_email_enabled !== false,
  };
}

async function fetchSettings(organizationId: string): Promise<OperationalEmailNotificationSettings> {
  const { data, error } = await supabase.rpc("get_or_create_operational_email_notification_settings", {
    p_organization_id: organizationId,
  });
  if (error) throw error;
  if (!data) {
    return {
      organization_id: organizationId,
      ...DEFAULT_OPERATIONAL_EMAIL_SETTINGS,
    };
  }
  return mapSettingsRow(data as OperationalEmailNotificationSettings);
}

export function useOperationalEmailSettings() {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [OPERATIONAL_EMAIL_SETTINGS_QUERY_KEY, organizationId],
    queryFn: async (): Promise<OperationalEmailNotificationSettings | null> => {
      if (!organizationId) return null;
      return fetchSettings(organizationId);
    },
    enabled: !!organizationId,
    staleTime: OPERATIONAL_EMAIL_SETTINGS_STALE_MS,
  });

  const save = useMutation({
    mutationFn: async (payload: OperationalEmailNotificationSettingsSave) => {
      if (!organizationId) throw new Error("Organization ID is required");
      const { data, error } = await supabase.rpc("upsert_operational_email_notification_settings", {
        p_organization_id: organizationId,
        p_daily_sales_summary_enabled: payload.daily_sales_summary_enabled,
        p_inventory_alerts_enabled: payload.inventory_alerts_enabled,
        p_promo_update_enabled: payload.promo_update_enabled,
        p_daily_gross_profit_enabled: payload.daily_gross_profit_enabled,
        p_shift_recap_email_enabled: payload.shift_recap_email_enabled,
      });
      if (error) throw error;
      return mapSettingsRow(data as OperationalEmailNotificationSettings);
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(
        [OPERATIONAL_EMAIL_SETTINGS_QUERY_KEY, organizationId],
        saved,
      );
    },
  });

  return {
    settings: query.data ?? null,
    isLoading: query.isLoading,
    save: save.mutateAsync,
    isSaving: save.isPending,
  };
}
