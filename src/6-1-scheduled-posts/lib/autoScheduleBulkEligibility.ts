import type { RequiredPlatformAutoTarget } from './resolveRequiredPlatformTargets';
import type { ScheduledPost } from '../types/scheduled-post';
import { pickAccountScheduleForModal } from './pickPlatformScheduleDisplay';

export type BulkSkipReason = 'oauth_disconnected' | 'missing_scopes' | 'active_schedule';

export type BulkSkippedTarget = {
  target: RequiredPlatformAutoTarget;
  reason: BulkSkipReason;
};

export function getActiveScheduleForTarget(
  schedules: ScheduledPost[],
  target: RequiredPlatformAutoTarget,
): ScheduledPost | null {
  const schedule = pickAccountScheduleForModal(schedules, target.platform, target.accountId);
  if (!schedule) return null;
  if (schedule.status === 'pending' || schedule.status === 'publishing') {
    return schedule;
  }
  return null;
}

export function getBulkEligibleTargets(
  targets: RequiredPlatformAutoTarget[],
  schedules: ScheduledPost[],
): { eligible: RequiredPlatformAutoTarget[]; skipped: BulkSkippedTarget[] } {
  const eligible: RequiredPlatformAutoTarget[] = [];
  const skipped: BulkSkippedTarget[] = [];

  for (const target of targets) {
    if (!target.oauthConnected) {
      skipped.push({ target, reason: 'oauth_disconnected' });
      continue;
    }
    if (!target.publishScopesOk) {
      skipped.push({ target, reason: 'missing_scopes' });
      continue;
    }
    if (getActiveScheduleForTarget(schedules, target)) {
      skipped.push({ target, reason: 'active_schedule' });
      continue;
    }
    eligible.push(target);
  }

  return { eligible, skipped };
}

export function formatSkippedTargetLabels(skipped: BulkSkippedTarget[]): string {
  return skipped
    .map(({ target }) => `${target.platform} › ${target.accountLabel}`)
    .join(', ');
}
