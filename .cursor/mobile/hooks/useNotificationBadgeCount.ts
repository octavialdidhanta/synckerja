/**
 * Returns total count for bell badge: unread comments + pending approval tasks + unread plan status updates + unread daily task notifications.
 * Uses same query keys as useReviewCommentNotifications (unread), completion_approvals count,
 * plan-status-change-notifications, and daily-task-notifications so invalidate on mark read / modal actions updates badge.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/1-login/contexts/AuthContext';
import { useCurrentOrg } from '@/features/1-login/hooks/useCurrentOrg';
import { useCurrentEmployee } from '@/features/share/hooks/useCurrentEmployee';

const REVIEW_COMMENT_QUERY_KEY = ['review-comment-notifications'] as const;
const COMPLETION_APPROVAL_COUNT_KEY = ['completion-approvals', 'count'] as const;
const PLAN_STATUS_CHANGE_QUERY_KEY = ['plan-status-change-notifications'] as const;
const DAILY_TASK_NOTIFICATIONS_QUERY_KEY = ['daily-task-notifications'] as const;

export function useNotificationBadgeCount() {
  const { user } = useAuth();
  const { organizationId } = useCurrentOrg();
  const { data: currentEmployee } = useCurrentEmployee();
  const userId = user?.id ?? null;

  const unreadQuery = useQuery({
    queryKey: [...REVIEW_COMMENT_QUERY_KEY, 'unread', userId, organizationId],
    enabled: !!userId && !!organizationId,
    queryFn: async (): Promise<number> => {
      if (!userId || !organizationId) return 0;
      const { count, error } = await supabase
        .from('review_comment_notifications')
        .select('id, social_media_plans!inner(organization_id)', { count: 'exact', head: true })
        .eq('user_id', userId)
        .is('read_at', null)
        .eq('social_media_plans.organization_id', organizationId);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const pendingCountQuery = useQuery({
    queryKey: [...COMPLETION_APPROVAL_COUNT_KEY, organizationId, currentEmployee?.id],
    enabled: !!organizationId && !!currentEmployee?.id,
    queryFn: async (): Promise<number> => {
      if (!organizationId || !currentEmployee?.id) return 0;
      const { count, error } = await supabase
        .from('completion_approvals')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('assigner_employee_id', currentEmployee.id)
        .eq('status', 'pending');
      if (error) throw error;
      return count ?? 0;
    },
  });

  const planStatusChangeUnreadQuery = useQuery({
    queryKey: [...PLAN_STATUS_CHANGE_QUERY_KEY, 'unread', userId, organizationId],
    enabled: !!userId && !!organizationId,
    queryFn: async (): Promise<number> => {
      if (!userId || !organizationId) return 0;
      const { count, error } = await supabase
        .from('plan_status_change_notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('organization_id', organizationId)
        .is('read_at', null);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const dailyTaskUnreadQuery = useQuery({
    queryKey: [...DAILY_TASK_NOTIFICATIONS_QUERY_KEY, 'unread', userId, organizationId],
    enabled: !!userId && !!organizationId,
    queryFn: async (): Promise<number> => {
      if (!userId || !organizationId) return 0;
      const { count, error } = await supabase
        .from('daily_task_notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('organization_id', organizationId)
        .is('read_at', null);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const unreadCount = unreadQuery.data ?? 0;
  const pendingCount = pendingCountQuery.data ?? 0;
  const planStatusChangeUnread = planStatusChangeUnreadQuery.data ?? 0;
  const dailyTaskUnread = dailyTaskUnreadQuery.data ?? 0;
  const totalCount = unreadCount + pendingCount + planStatusChangeUnread + dailyTaskUnread;
  const isLoading = unreadQuery.isLoading || pendingCountQuery.isLoading || planStatusChangeUnreadQuery.isLoading || dailyTaskUnreadQuery.isLoading;

  return { totalCount, isLoading };
}

/** Query key prefix for completion-approvals count (for invalidate from NotificationsModal / approval actions). */
export function getCompletionApprovalCountQueryKey(organizationId: string | null, employeeId: string | null) {
  return [...COMPLETION_APPROVAL_COUNT_KEY, organizationId, employeeId] as const;
}
