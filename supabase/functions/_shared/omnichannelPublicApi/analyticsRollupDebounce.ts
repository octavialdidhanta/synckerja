import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const DEFAULT_DEBOUNCE_SECONDS = 45;

export function scheduleAnalyticsRollupRefresh(admin: SupabaseClient, webId: string): void {
  const key = webId.trim().toLowerCase();
  if (!key) return;

  void admin
    .rpc("maybe_refresh_analytics_rollups", {
      p_web_id: key,
      p_debounce_seconds: DEFAULT_DEBOUNCE_SECONDS,
    })
    .then(({ data, error }) => {
      if (error) {
        console.error("scheduleAnalyticsRollupRefresh:", error.message);
        return;
      }
      const status = (data as { status?: string } | null)?.status;
      if (status === "error") {
        console.error("scheduleAnalyticsRollupRefresh:", JSON.stringify(data));
      }
    })
    .catch((e) => {
      console.error("scheduleAnalyticsRollupRefresh:", e);
    });
}
