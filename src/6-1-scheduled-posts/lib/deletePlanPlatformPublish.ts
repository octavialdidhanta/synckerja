import { supabase } from '@/shared/lib/supabaseClient';
import { parseEdgeFunctionError } from '@/tiktok-ads/lib/parseEdgeFunctionError';
import { getEdgeFunctionForPlatform } from './buildPlatformPublishPayload';

export type DeletePlanPlatformPublishResult = {
  ok?: boolean;
  already_deleted?: boolean;
  nothing_to_delete_on_platform?: boolean;
  platform_only_db_cleanup?: boolean;
  error?: string;
};

export async function deletePlanPlatformPublish(args: {
  platform: string;
  organizationId: string;
  planId: string;
  accountId: string;
}): Promise<DeletePlanPlatformPublishResult> {
  const platform = args.platform.trim();
  const functionName = getEdgeFunctionForPlatform(platform);

  const body: Record<string, unknown> = {
    action: 'delete',
    organization_id: args.organizationId,
    social_media_plan_id: args.planId,
  };

  if (platform === 'YouTube') {
    body.channel_id = args.accountId;
  } else if (platform === 'TikTok') {
    body.open_id = args.accountId;
  } else {
    throw new Error(`delete_not_supported:${platform}`);
  }

  const { data, error } = await supabase.functions.invoke(functionName, { body });
  if (error) throw await parseEdgeFunctionError(error, data);

  const payload = data as DeletePlanPlatformPublishResult;
  if (payload?.error) throw await parseEdgeFunctionError(null, payload);

  return payload;
}
