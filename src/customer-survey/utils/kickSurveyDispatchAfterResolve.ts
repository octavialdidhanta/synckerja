import { supabase } from '@/shared/lib/supabaseClient';
import { devLog } from '@/shared/lib/logger';

/**
 * After resolving a WhatsApp room, flush pending survey invite for this conversation via Edge Function.
 * Cron (`cron_tick`) remains useful as backoff / retries; this removes UX latency when resolving manually.
 */
export function kickSurveyDispatchAfterResolve(whatsappConversationId: string | null | undefined): void {
  const id = String(whatsappConversationId ?? '').trim();
  if (!id) return;

  void (async () => {
    try {
      const { error } = await supabase.functions.invoke('dispatch-customer-survey-wa', {
        body: {
          action: 'after_resolve',
          whatsapp_conversation_id: id,
        },
      });
      if (error) {
        devLog.warn('[kickSurveyDispatchAfterResolve]', error.message);
      }
    } catch (e) {
      devLog.warn('[kickSurveyDispatchAfterResolve]', e);
    }
  })();
}
