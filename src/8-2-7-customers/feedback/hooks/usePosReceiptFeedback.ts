import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { supabase } from '@/shared/lib/supabaseClient';
import type { FeedbackSentiment } from '../../lib/classifyFeedbackSentiment';
import type { PosReceiptFeedbackListResult, PosReceiptFeedbackRow } from '../types';

export const OPERATIONS_CUSTOMERS_FEEDBACK_QUERY_KEY = 'operations-customers-feedback';

function parseRow(raw: unknown): PosReceiptFeedbackRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id = String(o.id ?? '');
  if (!id) return null;
  const sentiment = o.sentiment === 'good' || o.sentiment === 'bad' ? o.sentiment : 'bad';
  return {
    id,
    invitationId: String(o.invitation_id ?? ''),
    salesActivityId: String(o.sales_activity_id ?? ''),
    posOutletId: o.pos_outlet_id != null ? String(o.pos_outlet_id) : null,
    servedByEmployeeId: o.served_by_employee_id != null ? String(o.served_by_employee_id) : null,
    rating: Number(o.rating ?? 0),
    sentiment,
    comment: o.comment != null ? String(o.comment) : null,
    replyText: o.reply_text != null ? String(o.reply_text) : null,
    repliedBy: o.replied_by != null ? String(o.replied_by) : null,
    repliedAt: o.replied_at != null ? String(o.replied_at) : null,
    submittedAt: String(o.submitted_at ?? ''),
    customerName: String(o.customer_name ?? '—'),
    outletName: String(o.outlet_name ?? '—'),
    employeeName: String(o.employee_name ?? '—'),
  };
}

export function usePosReceiptFeedback(filters: {
  outletId: string | null;
  employeeId: string | null;
  sentiment: FeedbackSentiment | null;
  from: string;
  to: string;
}) {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: [
      OPERATIONS_CUSTOMERS_FEEDBACK_QUERY_KEY,
      organizationId,
      filters.outletId,
      filters.employeeId,
      filters.sentiment,
      filters.from,
      filters.to,
    ],
    enabled: Boolean(organizationId) && Boolean(filters.from) && Boolean(filters.to),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<PosReceiptFeedbackListResult> => {
      if (!organizationId) return { goodCount: 0, badCount: 0, rows: [] };

      const { data, error } = await supabase.rpc('list_pos_receipt_feedback', {
        p_organization_id: organizationId,
        p_outlet_id: filters.outletId,
        p_employee_id: filters.employeeId,
        p_sentiment: filters.sentiment,
        p_from: filters.from,
        p_to: filters.to,
      });
      if (error) throw error;

      const payload = (data ?? {}) as Record<string, unknown>;
      if (payload.ok !== true) throw new Error(String(payload.error ?? 'load_failed'));

      const rowsRaw = Array.isArray(payload.rows) ? payload.rows : [];
      const rows = rowsRaw.map(parseRow).filter((row): row is PosReceiptFeedbackRow => row != null);

      return {
        goodCount: Number(payload.good_count ?? 0),
        badCount: Number(payload.bad_count ?? 0),
        rows,
      };
    },
  });
}
