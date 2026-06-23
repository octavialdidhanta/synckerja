import { supabase } from '@/shared/lib/supabaseClient';
import { computePlanDoneState } from '../lib/computeRequiredPlatformsProgress';

export async function syncPlanDoneStateClient(planId: string): Promise<boolean | null> {
  const { data: plan, error: planErr } = await supabase
    .from('social_media_plans')
    .select('id, service_id, done, content_type:content_types(name)')
    .eq('id', planId)
    .maybeSingle();

  if (planErr || !plan) return null;

  const contentTypeName = (plan as { content_type?: { name?: string } }).content_type?.name ?? null;
  const serviceId = (plan as { service_id?: string | null }).service_id;

  let required: Array<{ platform: string; is_active?: boolean }> = [];
  if (serviceId) {
    const { data: reqRows } = await supabase
      .from('service_required_platforms')
      .select('platform, is_active')
      .eq('service_id', serviceId)
      .eq('is_active', true);
    required = reqRows ?? [];
  }

  const { data: links } = await supabase
    .from('social_media_links')
    .select('platform, url')
    .eq('social_media_plan_id', planId);

  const done = computePlanDoneState(required, links ?? [], contentTypeName);
  const currentDone = Boolean((plan as { done?: boolean }).done);
  if (currentDone === done) return done;

  const { error: updateErr } = await supabase
    .from('social_media_plans')
    .update({ done, updated_at: new Date().toISOString() })
    .eq('id', planId);

  if (updateErr) {
    console.error('syncPlanDoneStateClient:', updateErr.message);
    return null;
  }
  return done;
}
