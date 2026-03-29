import { useState, useCallback, useEffect, useRef } from 'react';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useCurrentEmployee } from '@/shared/hooks/useCurrentEmployee';
import {
  fetchPendingApprovalsForAssigner,
  fetchRejectedForAssignee,
  approveCompletion,
  rejectCompletion,
  isStaleLinkRemovalRejection,
  type CompletionApprovalRow,
} from '../services/completionApprovalService';
import { supabase } from '@/shared/lib/supabaseClient';

/** Delay (ms) before fetching approval data so main task list loads first; keeps page load fast. */
const DEFER_APPROVAL_FETCH_MS = 800;

/** Key per (entity + assignee) for dedup; same entity rejected multiple times -> keep latest (first in DESC order). */
function getRejectionKeyForRow(row: CompletionApprovalRow): string {
  if (row.entity_type === 'task') return `task_${row.daily_task_id}_${row.assignee_employee_id}`;
  if (row.entity_type === 'step' && row.task_step_id) return `step_${row.task_step_id}_${row.assignee_employee_id}`;
  if (row.entity_type === 'substep' && row.task_steps_to_steps_id) return `substep_${row.task_steps_to_steps_id}_${row.assignee_employee_id}`;
  return '';
}

/** Exclude steps whose linked social_media_plan is already Prod Approved, or has Request Revision (approve/reject happens on /review). */
function filterPendingExcludingProdApproved(rows: CompletionApprovalRow[]): CompletionApprovalRow[] {
  return rows.filter((row) => {
    // 1) Exclude steps linked to plans that are already handled via /review (Prod Approved or Request Revision)
    if (row.entity_type === 'step' && row.task_steps?.social_media_plan_id) {
      if (row.task_steps?.social_media_plans?.production_approved === true) return false;
      if (row.task_steps?.social_media_plans?.production_status === 'Request Revision') return false;
    }

    // 2) Exclude reopened non-social step/sub-step approvals.
    // For social linked steps (View Content), keep showing card when production is unapproved
    // even if step is reopened, so reviewer can re-review content.
    if (
      row.entity_type === 'step' &&
      row.task_steps &&
      row.task_steps.is_completed === false &&
      !row.task_steps?.social_media_plan_id
    ) {
      return false;
    }
    if (row.entity_type === 'substep' && row.task_steps_to_steps && row.task_steps_to_steps.is_completed === false) {
      return false;
    }

    return true;
  });
}

export function useCompletionApprovals(refreshDeps: unknown[] = []) {
  const { organizationId } = useCurrentOrg();
  const { data: currentEmployee } = useCurrentEmployee();
  const [pending, setPending] = useState<CompletionApprovalRow[]>([]);
  const [rejected, setRejected] = useState<CompletionApprovalRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<Error | null>(null);
  const deferredRef = useRef(false);
  const isMountedRef = useRef(true);

  const refresh = useCallback(async () => {
    if (!organizationId || !currentEmployee?.id) {
      if (!isMountedRef.current) return;
      setPending([]);
      setRejected([]);
      setLoading(false);
      setFetchError(null);
      return;
    }
    if (!isMountedRef.current) return;
    setLoading(true);
    setFetchError(null);
    const [pendingRes, rejectedRes] = await Promise.all([
      fetchPendingApprovalsForAssigner(organizationId, currentEmployee.id),
      fetchRejectedForAssignee(organizationId, currentEmployee.id),
    ]);
    if (!isMountedRef.current) return;
    if (!pendingRes.error) setPending(filterPendingExcludingProdApproved(pendingRes.data));
    else console.warn('[useCompletionApprovals] Fetch pending approvals failed:', pendingRes.error.message);
    if (!rejectedRes.error) {
      const raw = rejectedRes.data ?? [];
      const seen = new Set<string>();
      const deduped = raw.filter((row) => {
        if (isStaleLinkRemovalRejection(row)) return false;
        const key = getRejectionKeyForRow(row);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setRejected(deduped);
    } else console.warn('[useCompletionApprovals] Fetch rejected for assignee failed:', rejectedRes.error.message);
    if (!isMountedRef.current) return;
    setFetchError(pendingRes.error ?? rejectedRes.error ?? null);
    setLoading(false);
  }, [organizationId, currentEmployee?.id, ...refreshDeps]);

  useEffect(() => {
    if (!organizationId || !currentEmployee?.id) return;
    isMountedRef.current = true;
    if (deferredRef.current) {
      refresh();
      return;
    }
    deferredRef.current = true;
    const t = setTimeout(() => {
      refresh();
    }, DEFER_APPROVAL_FETCH_MS);
    return () => {
      isMountedRef.current = false;
      clearTimeout(t);
    };
  }, [organizationId, currentEmployee?.id, refresh]);

  // Realtime: sync when approve/reject on another device or when /review updates social_media_plans
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!organizationId || !currentEmployee?.id) return;

    const channelNameCA = `completion_approvals_assigner_${currentEmployee.id}_${Date.now()}`;
    const channelCA = supabase
      .channel(channelNameCA)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'completion_approvals',
          filter: `assigner_employee_id=eq.${currentEmployee.id}`,
        },
        (payload: { eventType?: string }) => {
          refreshRef.current();
        }
      )
      .subscribe(() => {});

    const channelNameSMP = `social_media_plans_updates_${Date.now()}`;
    const channelSMP = supabase
      .channel(channelNameSMP)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'social_media_plans',
        },
        () => {
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => {
            debounceRef.current = null;
            refreshRef.current();
          }, 1500);
        }
      )
      .subscribe(() => {});

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      supabase.removeChannel(channelCA);
      supabase.removeChannel(channelSMP);
    };
  }, [organizationId, currentEmployee?.id]);

  const approve = useCallback(
    async (approvalId: string) => {
      if (!currentEmployee?.id) return { error: new Error('Not logged in') };
      const result = await approveCompletion(approvalId, currentEmployee.id);
      if (!result.error) await refresh();
      return result;
    },
    [currentEmployee?.id, refresh]
  );

  const reject = useCallback(
    async (approvalId: string, reason: string) => {
      if (!currentEmployee?.id) return { error: new Error('Not logged in') };
      const result = await rejectCompletion(approvalId, currentEmployee.id, reason);
      if (!result.error) await refresh();
      return result;
    },
    [currentEmployee?.id, refresh]
  );

  return { pending, rejected, loading, fetchError, refresh, approve, reject };
}

