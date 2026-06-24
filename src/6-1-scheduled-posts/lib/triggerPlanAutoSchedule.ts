import { supabase } from '@/shared/lib/supabaseClient';
import { devLog } from '@/shared/lib/logger';
import { toast } from 'sonner';
import i18n from '@/shared/i18n';

export type PlanAutoScheduleResponse = {
  eligible?: boolean;
  scheduled?: number;
  skipped?: unknown[];
  failed?: unknown[];
};

export async function triggerPlanAutoSchedule(
  planId: string,
  organizationId: string,
): Promise<PlanAutoScheduleResponse | null> {
  try {
    const { data, error } = await supabase.functions.invoke<PlanAutoScheduleResponse>(
      'social-media-plan-auto-schedule',
      {
        body: {
          organization_id: organizationId,
          social_media_plan_id: planId,
        },
      },
    );

    if (error) {
      devLog.warn('triggerPlanAutoSchedule invoke error', { planId, error });
      return null;
    }

    if (!data?.eligible) return data;

    const scheduled = data.scheduled ?? 0;
    const skippedCount = Array.isArray(data.skipped) ? data.skipped.length : 0;

    if (scheduled > 0 && skippedCount === 0) {
      toast.success(
        i18n.t('digitalMarketing.scheduledPosts.autoScheduleSuccess', { count: scheduled }),
      );
    } else if (scheduled > 0 && skippedCount > 0) {
      toast.success(
        i18n.t('digitalMarketing.scheduledPosts.autoSchedulePartial', {
          scheduled,
          skipped: skippedCount,
        }),
      );
    }

    return data;
  } catch (e) {
    devLog.warn('triggerPlanAutoSchedule failed', { planId, e });
    return null;
  }
}
