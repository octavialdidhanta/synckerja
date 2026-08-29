import { supabase } from '@/shared/lib/supabaseClient';

type Args = {
  organizationId: string;
  salesActivityId: string;
  outletId: string;
  createdByUserId: string | null;
  clientName: string;
  clientPhone: string | null;
  leadId: string;
};

async function resolveServedByEmployeeId(
  organizationId: string,
  userId: string | null,
): Promise<string | null> {
  if (!userId) return null;
  const { data } = await supabase
    .from('employees')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .maybeSingle();
  return data?.id ?? null;
}

/** Enqueue digital receipt share + invoke dispatch edge function (non-blocking). */
export async function enqueuePosReceiptFeedbackShare(args: Args): Promise<void> {
  const { data: settings } = await supabase
    .from('pos_outlet_receipt_settings')
    .select('share_via_email, share_via_sms')
    .eq('outlet_id', args.outletId)
    .maybeSingle();

  const shareViaEmail = Boolean(settings?.share_via_email);
  const shareViaSms = Boolean(settings?.share_via_sms);
  if (!shareViaEmail && !shareViaSms) return;

  const { data: lead } = await supabase
    .from('leads')
    .select('email, phone_number')
    .eq('id', args.leadId)
    .maybeSingle();

  const servedByEmployeeId = await resolveServedByEmployeeId(args.organizationId, args.createdByUserId);

  const { data: invitationId, error } = await supabase.rpc('enqueue_pos_receipt_feedback_invitation', {
    p_organization_id: args.organizationId,
    p_sales_activity_id: args.salesActivityId,
    p_pos_outlet_id: args.outletId,
    p_served_by_employee_id: servedByEmployeeId,
    p_customer_email: lead?.email ?? null,
    p_customer_phone: lead?.phone_number ?? args.clientPhone,
    p_customer_name: args.clientName,
    p_share_via_email: shareViaEmail,
    p_share_via_sms: shareViaSms,
  });

  if (error) {
    console.error('enqueuePosReceiptFeedbackShare: invitation failed', error);
    return;
  }

  if (!invitationId) return;

  void supabase.functions
    .invoke('dispatch-pos-receipt-feedback', {
      body: { invitationId },
    })
    .then(({ error: dispatchErr }) => {
      if (dispatchErr) console.error('enqueuePosReceiptFeedbackShare: dispatch failed', dispatchErr);
    });
}
