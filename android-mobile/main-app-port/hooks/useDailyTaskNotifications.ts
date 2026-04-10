import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useAuth } from "@/shared/auth/contexts/AuthContext";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";

const DAILY_TASK_NOTIFICATIONS_QUERY_KEY = ["daily-task-notifications"] as const;

export type DailyTaskNotificationRow = {
  id: string;
  user_id?: string | null;
  organization_id?: string | null;
  read_at: string | null;
  created_at: string;
  title: string;
  body?: string | null;
  daily_task_id?: string | null;
  task_step_id?: string | null;
  task_steps_to_steps_id?: string | null;
};

export function useDailyTaskNotifications() {
  const { user } = useAuth();
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;

  const listQuery = useQuery({
    queryKey: [...DAILY_TASK_NOTIFICATIONS_QUERY_KEY, "list", userId, organizationId],
    enabled: Boolean(userId && organizationId),
    queryFn: async (): Promise<DailyTaskNotificationRow[]> => {
      const { data, error } = await supabase
        .from("daily_task_notifications")
        .select(
          "id, read_at, created_at, title, body, daily_task_id, task_step_id, task_steps_to_steps_id, user_id, organization_id",
        )
        .eq("user_id", userId!)
        .eq("organization_id", organizationId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as DailyTaskNotificationRow[];
    },
  });

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [...DAILY_TASK_NOTIFICATIONS_QUERY_KEY] });
  }, [queryClient]);

  const markOneRead = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("daily_task_notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
      if (!error) invalidate();
    },
    [invalidate],
  );

  const markAllRead = useCallback(async () => {
    if (!userId || !organizationId) return;
    const { error } = await supabase
      .from("daily_task_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("organization_id", organizationId)
      .is("read_at", null);
    if (!error) invalidate();
  }, [userId, organizationId, invalidate]);

  return {
    notifications: listQuery.data ?? [],
    isLoading: listQuery.isLoading,
    markOneRead,
    markAllRead,
    refetch: listQuery.refetch,
  };
}
