import { useCallback } from 'react';
import { useUnifiedScheduleMutations } from './useUnifiedScheduleMutations';
import {
  getBulkEligibleTargets,
  type BulkSkippedTarget,
} from '../lib/autoScheduleBulkEligibility';
import { resolveScheduledAtUtc } from '../lib/resolveScheduledAtUtc';
import {
  isPlanEligibleForPublish,
  type PlanAutoScheduleEligibilityInput,
} from '../lib/planAutoScheduleEligibility';
import type { RequiredPlatformAutoTarget } from '../lib/resolveRequiredPlatformTargets';
import type { ScheduledPost } from '../types/scheduled-post';
import { pickAccountScheduleForModal } from '../lib/pickPlatformScheduleDisplay';
import { classifyPublishAttempt, publishPlatformRank, type PublishAttemptOutcome } from '../lib/publishSequence';
import { supabase } from '@/shared/lib/supabaseClient';

export type PublishPlatformResult = {
  platform: string;
  accountLabel: string;
  ok: boolean;
  processing?: boolean;
  waitingRetry?: boolean;
  error?: string;
};

export type PlanBulkPublishArgs = {
  action: 'schedule' | 'post_now';
  targets: RequiredPlatformAutoTarget[];
  schedules: ScheduledPost[];
  organizationId: string;
  planId: string;
  caption: string;
  title?: string;
  employeeId?: string;
  postDateYmd: string;
  getTimeWib: (rowId: string) => string;
  getPrivacyLevel?: (rowId: string, platform?: string) => string | undefined;
  driveLinkBlocked?: boolean;
  planEligibility?: PlanAutoScheduleEligibilityInput;
  ownerBypass?: boolean;
  beforePublish?: () => Promise<void>;
  onTargetSuccess?: (target: RequiredPlatformAutoTarget) => void;
};

type PostNowResponse = {
  processing?: boolean;
  ok?: boolean;
  error?: string;
  external_post_id?: string | null;
  schedule?: {
    status?: string;
    external_post_id?: string | null;
    next_retry_at?: string | null;
  } | null;
};

const PUBLISH_WAIT_MS = 6 * 60 * 1000;
const PUBLISH_POLL_MS = 2000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readAccountSchedule(
  planId: string,
  platform: string,
  accountId: string,
): Promise<ScheduledPost | null> {
  const { data, error } = await supabase
    .from('social_media_scheduled_posts')
    .select('*')
    .eq('social_media_plan_id', planId)
    .eq('platform', platform)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(8);
  if (error) return null;
  return pickAccountScheduleForModal((data ?? []) as ScheduledPost[], platform, accountId);
}

async function waitForAccountPublish(
  planId: string,
  platform: string,
  accountId: string,
): Promise<PublishAttemptOutcome> {
  const deadline = Date.now() + PUBLISH_WAIT_MS;
  while (Date.now() < deadline) {
    const row = await readAccountSchedule(planId, platform, accountId);
    const outcome = classifyPublishAttempt(row);
    if (outcome !== 'in_progress') return outcome;
    await sleep(PUBLISH_POLL_MS);
  }
  return 'retry_wait';
}

function resultFromOutcome(
  target: RequiredPlatformAutoTarget,
  outcome: PublishAttemptOutcome,
): PublishPlatformResult {
  if (outcome === 'published') {
    return { platform: target.platform, accountLabel: target.accountLabel, ok: true };
  }
  if (outcome === 'retry_wait' || outcome === 'in_progress') {
    return {
      platform: target.platform,
      accountLabel: target.accountLabel,
      ok: false,
      waitingRetry: true,
      error: 'retry_scheduled',
    };
  }
  return {
    platform: target.platform,
    accountLabel: target.accountLabel,
    ok: false,
    error: 'publish_failed',
  };
}

export function usePlanBulkPublish() {
  const { scheduleMutation, postNowMutation } = useUnifiedScheduleMutations();

  const publishOneTarget = useCallback(
    async (
      target: RequiredPlatformAutoTarget,
      args: PlanBulkPublishArgs,
    ): Promise<PublishPlatformResult> => {
      if (!target.oauthConnected || !target.publishScopesOk) {
        return {
          platform: target.platform,
          accountLabel: target.accountLabel,
          ok: false,
          error: 'oauth_or_scopes',
        };
      }

      const timeWib = args.getTimeWib(target.requiredPlatformRowId);
      const scheduledAtIso =
        args.action === 'post_now'
          ? new Date().toISOString()
          : resolveScheduledAtUtc(args.postDateYmd, timeWib);

      if (!scheduledAtIso && args.action === 'schedule') {
        return {
          platform: target.platform,
          accountLabel: target.accountLabel,
          ok: false,
          error: 'invalid_schedule_time',
        };
      }

      const mutationArgs = {
        platform: target.platform,
        organizationId: args.organizationId,
        planId: args.planId,
        accountId: target.accountId,
        accountLabel: target.accountLabel,
        caption: args.caption,
        title: args.title,
        employeeId: args.employeeId,
        privacyLevel:
          args.getPrivacyLevel &&
          (target.platform === 'YouTube' || target.platform === 'TikTok')
            ? args.getPrivacyLevel(target.requiredPlatformRowId, target.platform)
            : undefined,
      };

      try {
        if (args.action === 'schedule') {
          await scheduleMutation.mutateAsync({
            ...mutationArgs,
            scheduledAtIso: scheduledAtIso!,
          });
        } else {
          const data = (await postNowMutation.mutateAsync(mutationArgs)) as PostNowResponse;
          const immediate = classifyPublishAttempt(data?.schedule ?? null);
          const alreadySent = Boolean(data?.external_post_id) || immediate === 'published';
          const outcome = alreadySent
            ? 'published'
            : await waitForAccountPublish(args.planId, target.platform, target.accountId);
          const result = resultFromOutcome(target, outcome);
          if (result.ok) args.onTargetSuccess?.(target);
          return result;
        }

        args.onTargetSuccess?.(target);
        return {
          platform: target.platform,
          accountLabel: target.accountLabel,
          ok: true,
        };
      } catch (e) {
        const message = e instanceof Error ? e.message : 'failed';
        if (args.action === 'post_now' && message.includes('already_publishing')) {
          const outcome = await waitForAccountPublish(args.planId, target.platform, target.accountId);
          const result = resultFromOutcome(target, outcome);
          if (result.ok) args.onTargetSuccess?.(target);
          return result;
        }
        return {
          platform: target.platform,
          accountLabel: target.accountLabel,
          ok: false,
          error: message,
        };
      }
    },
    [scheduleMutation, postNowMutation],
  );

  const runBulkPublish = useCallback(
    async (args: PlanBulkPublishArgs): Promise<{
      results: PublishPlatformResult[];
      skipped: BulkSkippedTarget[];
    }> => {
      if (args.driveLinkBlocked) {
        throw new Error('share.publish.errors.driveNotPublic');
      }

      if (
        args.planEligibility &&
        !isPlanEligibleForPublish(args.planEligibility, { ownerBypass: args.ownerBypass })
      ) {
        throw new Error('share.publish.errors.notEligible');
      }

      if (args.beforePublish) {
        await args.beforePublish();
      }

      if (args.planEligibility && !args.ownerBypass) {
        if (!isPlanEligibleForPublish(args.planEligibility)) {
          throw new Error('share.publish.errors.notEligible');
        }
      }

      if (!args.postDateYmd) {
        throw new Error('Post date is required');
      }

      const { eligible, skipped } = getBulkEligibleTargets(args.targets, args.schedules);
      const byTableOrder = (left: RequiredPlatformAutoTarget, right: RequiredPlatformAutoTarget) =>
        publishPlatformRank(left.platform) - publishPlatformRank(right.platform) ||
        left.accountId.localeCompare(right.accountId);
      const results: PublishPlatformResult[] = [];

      if (args.action === 'schedule') {
        for (const target of [...eligible].sort(byTableOrder)) {
          results.push(await publishOneTarget(target, args));
        }
        return { results, skipped };
      }

      const chain = args.targets
        .filter((target) => target.oauthConnected && target.publishScopesOk)
        .sort(byTableOrder);
      for (const target of chain) {
        const existing = pickAccountScheduleForModal(args.schedules, target.platform, target.accountId);
        if (classifyPublishAttempt(existing) === 'published') continue;
        if (existing?.status === 'publishing') {
          const outcome = await waitForAccountPublish(args.planId, target.platform, target.accountId);
          const result = resultFromOutcome(target, outcome);
          results.push(result);
          if (!result.ok) break;
          continue;
        }
        const result = await publishOneTarget(target, args);
        results.push(result);
        if (!result.ok) break;
      }

      return { results, skipped };
    },
    [publishOneTarget],
  );

  const isPending = scheduleMutation.isPending || postNowMutation.isPending;

  return {
    runBulkPublish,
    publishOneTarget,
    scheduleMutation,
    postNowMutation,
    isPending,
  };
}
