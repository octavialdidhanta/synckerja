import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import {
  isAnyPosReceiptSent,
  markPosReceiptSentLocal,
  mergePosReceiptSentChannels,
  readPosReceiptSentLocal,
  type PosReceiptSentChannels,
} from "@/pos-mobile/shared/lib/posReceiptSentStorage";

export const POS_RECEIPT_SENT_QUERY_KEY = "pos-receipt-sent-status";

async function fetchPosReceiptSentStatus(
  activityId: string,
): Promise<PosReceiptSentChannels> {
  const local = readPosReceiptSentLocal(activityId);
  const { data, error } = await supabase.rpc("get_pos_receipt_send_status", {
    p_sales_activity_id: activityId,
  });
  if (error || !data || typeof data !== "object") {
    return local;
  }
  const row = data as { email_sent?: unknown; sms_sent?: unknown };
  const remote: PosReceiptSentChannels = {
    email: Boolean(row.email_sent),
    sms: Boolean(row.sms_sent),
  };
  return mergePosReceiptSentChannels(local, remote);
}

/** Digital receipt send flags for a sales activity (Activity + pay-success). */
export function usePosReceiptSentStatus(activityId: string | null | undefined) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: [POS_RECEIPT_SENT_QUERY_KEY, activityId],
    enabled: Boolean(activityId),
    queryFn: () => fetchPosReceiptSentStatus(activityId!),
    staleTime: 30_000,
  });

  const channels = query.data ?? readPosReceiptSentLocal(activityId);

  const markSent = (channel: "email" | "sms") => {
    if (!activityId) return;
    const next = markPosReceiptSentLocal(activityId, channel);
    queryClient.setQueryData([POS_RECEIPT_SENT_QUERY_KEY, activityId], next);
  };

  return {
    channels,
    emailSent: channels.email,
    smsSent: channels.sms,
    anySent: isAnyPosReceiptSent(channels),
    isLoading: query.isLoading,
    markSent,
    refetch: query.refetch,
  };
}
