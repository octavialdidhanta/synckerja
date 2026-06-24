import { supabase } from '@/shared/lib/supabaseClient';
import {
  computePlanDoneState,
  computeRequiredPlatformProgressItems,
  filterRequiredPlatformsForContentType,
  type RequiredPlatformInput,
  type SocialMediaLinkInput,
} from './computeRequiredPlatformsProgress';
import { derivePlanPostMetadataClient } from './derivePlanPostMetadata';
import type { ScheduledPost } from '../types/scheduled-post';

export type SyncPlanCompletionClientResult = {
  done: boolean | null;
  actual_post_date: string | null;
  on_time_status: string;
};

export async function syncPlanCompletionStateClient(
  planId: string,
): Promise<SyncPlanCompletionClientResult | null> {
  const { data: plan, error: planErr } = await supabase
    .from('social_media_plans')
    .select(
      'id, service_id, done, post_date, actual_post_date, on_time_status, content_type:content_types(name)',
    )
    .eq('id', planId)
    .maybeSingle();

  if (planErr || !plan) {
    console.error('syncPlanCompletionStateClient plan:', planErr?.message);
    return null;
  }

  const contentTypeName = (plan as { content_type?: { name?: string } }).content_type?.name ?? null;
  const serviceId = (plan as { service_id?: string | null }).service_id;

  let required: RequiredPlatformInput[] = [];
  if (serviceId) {
    const { data: reqRows } = await supabase
      .from('service_required_platforms')
      .select(
        'id, platform, is_active, platform_account_id, platform_account_label, custom_platform_name',
      )
      .eq('service_id', serviceId)
      .eq('is_active', true);
    required = (reqRows ?? []) as RequiredPlatformInput[];
  }

  const { data: links } = await supabase
    .from('social_media_links')
    .select('platform, url, platform_account_open_id, created_at')
    .eq('social_media_plan_id', planId);

  const { data: scheduleRows } = await supabase
    .from('social_media_scheduled_posts')
    .select(
      'id, platform, status, created_at, published_at, provider_config, platform_account_id, social_media_plan_id',
    )
    .eq('social_media_plan_id', planId);

  const linkRows = (links ?? []) as SocialMediaLinkInput[];
  const schedules = (scheduleRows ?? []) as ScheduledPost[];
  const activeRequired = filterRequiredPlatformsForContentType(required, contentTypeName);
  const hasRequiredPlatforms = activeRequired.length > 0;

  const done = computePlanDoneState(required, linkRows, contentTypeName, schedules);
  const items = computeRequiredPlatformProgressItems(
    required,
    linkRows,
    contentTypeName,
    schedules,
  );
  const metadata = derivePlanPostMetadataClient(
    items,
    linkRows,
    (plan as { post_date?: string | null }).post_date ?? null,
    hasRequiredPlatforms,
  );

  const currentDone = Boolean((plan as { done?: boolean }).done);
  const currentActual = (plan as { actual_post_date?: string | null }).actual_post_date ?? null;
  const currentOnTime = String((plan as { on_time_status?: string | null }).on_time_status ?? '').trim();

  const needsUpdate =
    currentDone !== done
    || currentActual !== metadata.actual_post_date
    || currentOnTime !== metadata.on_time_status;

  if (!needsUpdate) {
    return { done, ...metadata };
  }

  const { error: updateErr } = await supabase
    .from('social_media_plans')
    .update({
      done,
      actual_post_date: metadata.actual_post_date,
      on_time_status: metadata.on_time_status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', planId);

  if (updateErr) {
    console.error('syncPlanCompletionStateClient update:', updateErr.message);
    return null;
  }

  return { done, ...metadata };
}

/** @deprecated Use syncPlanCompletionStateClient */
export async function syncPlanDoneStateClient(planId: string): Promise<boolean | null> {
  const result = await syncPlanCompletionStateClient(planId);
  return result?.done ?? null;
}

export async function syncPlanPostMetadataClient(
  planId: string,
): Promise<{ actual_post_date: string | null; on_time_status: string } | null> {
  const result = await syncPlanCompletionStateClient(planId);
  if (!result) return null;
  return {
    actual_post_date: result.actual_post_date,
    on_time_status: result.on_time_status,
  };
}

export function planNeedsStaleMetadataSync(plan: {
  done?: boolean | null;
  actual_post_date?: string | null;
  on_time_status?: string | null;
}): boolean {
  const onTime = String(plan.on_time_status ?? '').trim();
  const hasActual = Boolean(plan.actual_post_date);
  const isDone = Boolean(plan.done);

  if (!isDone && hasActual) return true;
  if (onTime === 'Ontime' && !hasActual) return true;
  if (onTime.startsWith('Late') && !hasActual) return true;
  if (isDone && !hasActual && onTime !== 'In Progress' && onTime !== 'Scheduled') return true;
  return false;
}
