import { supabase } from '@/shared/lib/supabaseClient';
import { parseEdgeFunctionError } from '@/shared/lib/parseEdgeFunctionError';
import type { RequiredPlatformAutoTarget } from '../lib/resolveRequiredPlatformTargets';
import { buildBulkPostNowTargetsPayload } from '../lib/buildPlatformPublishPayload';
import type { PublishPlatformResult } from './usePlanBulkPublish';

type OrchestratorScheduleRow = {
  id: string;
  platform: string;
  provider_config?: { account_label?: string };
};

type OrchestratorPartialError = {
  platform: string;
  account_label: string;
  error?: string;
};

type OrchestratorResponse = {
  ok?: boolean;
  processing?: boolean;
  error?: string;
  schedules?: OrchestratorScheduleRow[];
  partial_insert_errors?: OrchestratorPartialError[];
};

export async function invokePlanBulkPostNowOrchestrator(args: {
  organizationId: string;
  planId: string;
  caption: string;
  title?: string;
  employeeId?: string;
  targets: RequiredPlatformAutoTarget[];
  getPrivacyLevel?: (rowId: string, platform?: string) => string | undefined;
}): Promise<PublishPlatformResult[]> {
  const targetsPayload = buildBulkPostNowTargetsPayload(
    args.targets,
    args.getPrivacyLevel,
  );

  const { data, error } = await supabase.functions.invoke('social-media-plan-publish', {
    body: {
      action: 'post_now_bulk',
      organization_id: args.organizationId,
      social_media_plan_id: args.planId,
      caption: args.caption,
      title: args.title ?? null,
      employee_id: args.employeeId ?? null,
      targets: targetsPayload,
    },
  });

  if (error) throw await parseEdgeFunctionError(error, data);

  const payload = data as OrchestratorResponse;
  if (payload?.error) throw await parseEdgeFunctionError(null, payload);
  if (!payload?.ok) throw new Error('publish_failed');

  const processing = Boolean(payload.processing);
  const schedules = payload.schedules ?? [];
  const partialErrors = payload.partial_insert_errors ?? [];

  const results: PublishPlatformResult[] = [];

  for (const target of args.targets) {
    const schedule = schedules.find(
      (s) =>
        s.platform === target.platform &&
        String(s.provider_config?.account_label ?? '').trim() === target.accountLabel.trim(),
    );

    if (schedule) {
      results.push({
        platform: target.platform,
        accountLabel: target.accountLabel,
        ok: true,
        processing,
      });
      continue;
    }

    const partial = partialErrors.find(
      (p) => p.platform === target.platform && p.account_label === target.accountLabel,
    );
    if (partial) {
      results.push({
        platform: target.platform,
        accountLabel: target.accountLabel,
        ok: false,
        error: partial.error ?? 'failed',
      });
      continue;
    }

    results.push({
      platform: target.platform,
      accountLabel: target.accountLabel,
      ok: true,
      processing,
    });
  }

  return results;
}
