import { useCallback } from 'react';
import { useUnifiedScheduleMutations } from './useUnifiedScheduleMutations';
import { invokePlanBulkPostNowOrchestrator } from './usePlanBulkPostNowOrchestrator';
import { invalidatePlanPublishQueries } from '../lib/invalidatePlanPublishQueries';
import { useQueryClient } from '@tanstack/react-query';
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

export type PublishPlatformResult = {
  platform: string;
  accountLabel: string;
  ok: boolean;
  processing?: boolean;
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
  /** Parallel invokes for post_now only (schedule stays sequential). */
  parallelPostNow?: boolean;
  driveLinkBlocked?: boolean;
  planEligibility?: PlanAutoScheduleEligibilityInput;
  ownerBypass?: boolean;
  beforePublish?: () => Promise<void>;
  onTargetSuccess?: (target: RequiredPlatformAutoTarget) => void;
};

type PostNowResponse = {
  processing?: boolean;
  ok?: boolean;
};

export function usePlanBulkPublish() {
  const queryClient = useQueryClient();
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
          const processing = Boolean(data?.processing);
          args.onTargetSuccess?.(target);
          return {
            platform: target.platform,
            accountLabel: target.accountLabel,
            ok: true,
            processing,
          };
        }

        args.onTargetSuccess?.(target);
        return {
          platform: target.platform,
          accountLabel: target.accountLabel,
          ok: true,
        };
      } catch (e) {
        return {
          platform: target.platform,
          accountLabel: target.accountLabel,
          ok: false,
          error: e instanceof Error ? e.message : 'failed',
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

      let results: PublishPlatformResult[];

      if (args.action === 'post_now' && args.parallelPostNow) {
        const orchestratorResults = await invokePlanBulkPostNowOrchestrator({
          organizationId: args.organizationId,
          planId: args.planId,
          caption: args.caption,
          title: args.title,
          employeeId: args.employeeId,
          targets: eligible,
          getPrivacyLevel: args.getPrivacyLevel,
        });
        await invalidatePlanPublishQueries(queryClient, {
          organizationId: args.organizationId,
          planId: args.planId,
        });
        for (const target of eligible) {
          const row = orchestratorResults.find(
            (r) => r.platform === target.platform && r.accountLabel === target.accountLabel,
          );
          if (row?.ok) args.onTargetSuccess?.(target);
        }
        results = orchestratorResults;
      } else {
        results = [];
        for (const target of eligible) {
          results.push(await publishOneTarget(target, args));
        }
      }

      return { results, skipped };
    },
    [publishOneTarget, queryClient],
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
