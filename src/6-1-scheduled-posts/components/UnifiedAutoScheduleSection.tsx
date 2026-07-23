import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import type { ServiceRequiredPlatform } from '@/6-1-dashboard/hook/useServiceRequiredPlatforms';
import { GoogleDriveFilePreview } from '@/6-1-dashboard/modal/GoogleDriveInAppFilePreview';
import { useOrgDefaultPostTime } from '../hooks/useOrgDefaultPostTime';
import { useConnectedPlatformAccounts } from '../hooks/useConnectedPlatformAccounts';
import { useScheduledPostsByPlan } from '../hooks/useScheduledPostsByPlan';
import { useUnifiedScheduleMutations } from '../hooks/useUnifiedScheduleMutations';
import { listAllAutoScheduleTargets } from '../lib/resolveRequiredPlatformTargets';
import type { RequiredPlatformAutoTarget } from '../lib/resolveRequiredPlatformTargets';
import { resolveScheduledAtUtc } from '../lib/resolveScheduledAtUtc';
import { validateGoogleDriveVideoLink } from '../lib/validateGoogleDriveVideoLink';
import { pickAccountScheduleForModal } from '../lib/pickPlatformScheduleDisplay';
import {
  formatSkippedTargetLabels,
  getBulkEligibleTargets,
} from '../lib/autoScheduleBulkEligibility';
import { notifyPublishMutationError } from '../lib/notifyPublishMutationError';
import { RequiredPlatformScheduleRow } from './RequiredPlatformScheduleRow';
import { DeletePublishedConfirmDialog } from './DeletePublishedConfirmDialog';
import { useDeletePublishedPost } from '../hooks/useDeletePublishedPost';
import { useSocialMediaLinks } from '@/6-1-dashboard/hook/useSocialMediaLinks';
import { canDeletePublishedPlatformRow } from '../lib/canDeletePublishedPlatformRow';
import {
  SCHEDULE_TABLE_ACTIONS_HEAD_CLASS,
  SCHEDULE_TABLE_CONNECTION_CELL_CLASS,
  SCHEDULE_TABLE_HEADER_ROW_CLASS,
  SCHEDULE_TABLE_MIDDLE_GROUP_CLASS,
  SCHEDULE_TABLE_MIDDLE_HEAD_CLASS,
  SCHEDULE_TABLE_PLATFORM_HEAD_CLASS,
  SCHEDULE_TABLE_SCROLL_CLASS,
  SCHEDULE_TABLE_STATUS_CELL_CLASS,
  SCHEDULE_TABLE_TIME_CELL_CLASS,
  SCHEDULE_TABLE_VISIBILITY_CELL_CLASS,
} from './scheduleTableColumnStyles';
import { DEFAULT_YOUTUBE_SCHEDULE_PRIVACY } from '../lib/youtubeSchedulePrivacy';
import { DEFAULT_TIKTOK_SCHEDULE_PRIVACY } from '../lib/tiktokSchedulePrivacy';
import { useUpsertPlanScheduleManualLock } from '../hooks/usePlanScheduleManualLocks';

type Props = {
  organizationId: string;
  planId: string;
  planTitle: string | null;
  postDate: string | null;
  caption: string;
  onCaptionChange: (value: string) => void;
  googleDriveLink?: string | null;
  employeeId?: string;
  eligible: boolean;
  serviceId?: string | null;
  requiredPlatforms: ServiceRequiredPlatform[];
};

type PublishResult = { ok: true } | { ok: false; error: string };

function getReconnectHint(platform: string, t: (key: string) => string): string {
  switch (platform) {
    case 'TikTok':
      return t('digitalMarketing.scheduledPosts.reconnectPublishScopes');
    case 'YouTube':
      return t('digitalMarketing.scheduledPosts.youtubeReconnectUpload');
    case 'Instagram':
      return t('digitalMarketing.scheduledPosts.instagramReconnectPublish');
    case 'Facebook':
      return t('digitalMarketing.scheduledPosts.facebookReconnectPublish');
    case 'LinkedIn':
      return t('digitalMarketing.scheduledPosts.linkedinReconnectPublish');
    default:
      return t('digitalMarketing.scheduledPosts.oauthAccountRequired');
  }
}

export function UnifiedAutoScheduleSection({
  organizationId,
  planId,
  planTitle,
  postDate,
  caption,
  onCaptionChange,
  googleDriveLink,
  employeeId,
  eligible,
  serviceId,
  requiredPlatforms,
}: Props) {
  const { t } = useTranslation();
  const { data: defaultTime } = useOrgDefaultPostTime();
  const { accounts: connectedAccounts, isLoading: accountsLoading } =
    useConnectedPlatformAccounts(organizationId);
  const { data: schedules } = useScheduledPostsByPlan(planId);
  const { links: planLinks } = useSocialMediaLinks(planId);
  const { scheduleMutation, postNowMutation, cancelMutation } = useUnifiedScheduleMutations();
  const deletePublishedMutation = useDeletePublishedPost();
  const upsertManualLock = useUpsertPlanScheduleManualLock();
  const [deleteTarget, setDeleteTarget] = useState<RequiredPlatformAutoTarget | null>(null);

  const lockAccount = useCallback(
    (target: RequiredPlatformAutoTarget) => {
      void upsertManualLock.mutateAsync({
        organizationId,
        planId,
        platform: target.platform,
        accountId: target.accountId,
      });
    },
    [organizationId, planId, upsertManualLock],
  );

  const targets = useMemo(
    () => listAllAutoScheduleTargets(requiredPlatforms, connectedAccounts),
    [requiredPlatforms, connectedAccounts],
  );

  const defaultTimeWib = defaultTime ?? '18:00';
  const [timeWibByRowId, setTimeWibByRowId] = useState<Record<string, string>>({});
  const [privacyByRowId, setPrivacyByRowId] = useState<Record<string, string>>({});
  const [isBulkRunning, setIsBulkRunning] = useState(false);

  useEffect(() => {
    if (!targets.length) return;
    setTimeWibByRowId((prev) => {
      const next = { ...prev };
      for (const target of targets) {
        if (!next[target.requiredPlatformRowId]) {
          next[target.requiredPlatformRowId] = defaultTimeWib;
        }
      }
      return next;
    });
    setPrivacyByRowId((prev) => {
      const next = { ...prev };
      for (const target of targets) {
        if (!next[target.requiredPlatformRowId]) {
          if (target.platform === 'YouTube') {
            next[target.requiredPlatformRowId] = DEFAULT_YOUTUBE_SCHEDULE_PRIVACY;
          } else if (target.platform === 'TikTok') {
            next[target.requiredPlatformRowId] = DEFAULT_TIKTOK_SCHEDULE_PRIVACY;
          }
        }
      }
      return next;
    });
  }, [targets, defaultTimeWib]);

  const postDateYmd = postDate?.slice(0, 10) ?? '';
  const driveLink = googleDriveLink?.trim() ?? '';
  const driveValidation = useMemo(() => validateGoogleDriveVideoLink(driveLink), [driveLink]);
  const fieldLabel = 'text-[11px] font-medium uppercase tracking-wide text-muted-foreground';

  const scheduleRows = schedules ?? [];
  const { eligible: bulkEligible } = useMemo(
    () => getBulkEligibleTargets(targets, scheduleRows),
    [targets, scheduleRows],
  );

  const getTimeWib = useCallback(
    (rowId: string) => timeWibByRowId[rowId] ?? defaultTimeWib,
    [timeWibByRowId, defaultTimeWib],
  );

  const getPrivacyLevel = useCallback(
    (rowId: string, platform?: string) => {
      if (privacyByRowId[rowId]) return privacyByRowId[rowId];
      if (platform === 'TikTok') return DEFAULT_TIKTOK_SCHEDULE_PRIVACY;
      return DEFAULT_YOUTUBE_SCHEDULE_PRIVACY;
    },
    [privacyByRowId],
  );

  const isRowMutationPending =
    scheduleMutation.isPending ||
    postNowMutation.isPending ||
    cancelMutation.isPending ||
    deletePublishedMutation.isPending;

  const bulkDisabled =
    isBulkRunning ||
    isRowMutationPending ||
    !postDateYmd ||
    bulkEligible.length === 0;

  const runPublish = useCallback(
    async (
      target: RequiredPlatformAutoTarget,
      action: 'schedule' | 'post_now',
      options?: { silent?: boolean },
    ): Promise<PublishResult> => {
      const silent = options?.silent ?? false;

      if (!target.oauthConnected) {
        const error = t('digitalMarketing.scheduledPosts.oauthAccountRequired');
        if (!silent) toast.error(error);
        return { ok: false, error };
      }
      if (!target.publishScopesOk) {
        const error = getReconnectHint(target.platform, t);
        if (!silent) toast.error(error);
        return { ok: false, error };
      }
      if (!postDateYmd) {
        const error = 'Post date is required';
        if (!silent) toast.error(error);
        return { ok: false, error };
      }

      const timeWib = getTimeWib(target.requiredPlatformRowId);
      const scheduledAtIso =
        action === 'post_now' ? new Date().toISOString() : resolveScheduledAtUtc(postDateYmd, timeWib);
      if (!scheduledAtIso && action === 'schedule') {
        const error = 'Invalid schedule time';
        if (!silent) toast.error(error);
        return { ok: false, error };
      }

      const args = {
        platform: target.platform,
        organizationId,
        planId,
        accountId: target.accountId,
        accountLabel: target.accountLabel,
        caption,
        title: planTitle ?? undefined,
        employeeId,
        privacyLevel:
          target.platform === 'YouTube' || target.platform === 'TikTok'
            ? getPrivacyLevel(target.requiredPlatformRowId, target.platform)
            : undefined,
      };

      try {
        if (action === 'schedule') {
          await scheduleMutation.mutateAsync({
            ...args,
            scheduledAtIso: scheduledAtIso!,
          });
          lockAccount(target);
          if (!silent) {
            toast.success(t('digitalMarketing.scheduledPosts.scheduledFor', { time: timeWib }));
          }
        } else {
          await postNowMutation.mutateAsync(args);
          lockAccount(target);
          if (!silent) {
            toast.success(
              t('digitalMarketing.scheduledPosts.publishedPlatform', { platform: target.platform }),
            );
          }
        }
        return { ok: true };
      } catch (e) {
        const error = e instanceof Error ? e.message : t('digitalMarketing.scheduledPosts.publishFailed');
        if (!silent) notifyPublishMutationError(e, t);
        return { ok: false, error };
      }
    },
    [
      t,
      postDateYmd,
      getTimeWib,
      getPrivacyLevel,
      organizationId,
      planId,
      caption,
      planTitle,
      employeeId,
      scheduleMutation,
      postNowMutation,
      lockAccount,
    ],
  );

  const runBulkPublish = useCallback(
    async (action: 'schedule' | 'post_now') => {
      const { eligible: eligibleTargets, skipped } = getBulkEligibleTargets(targets, scheduleRows);

      if (!postDateYmd) {
        toast.error('Post date is required');
        return;
      }
      if (eligibleTargets.length === 0) {
        toast.info(t('digitalMarketing.scheduledPosts.bulkNoneReady'));
        return;
      }

      setIsBulkRunning(true);
      let succeeded = 0;
      let failed = 0;

      try {
        for (const target of eligibleTargets) {
          const result = await runPublish(target, action, { silent: true });
          if (result.ok) {
            succeeded += 1;
          } else {
            failed += 1;
          }
        }

        const skippedLabel = formatSkippedTargetLabels(skipped);

        if (succeeded > 0 && failed === 0) {
          if (action === 'schedule') {
            toast.success(
              t('digitalMarketing.scheduledPosts.bulkScheduleSuccess', { count: succeeded }),
            );
          } else {
            toast.success(
              t('digitalMarketing.scheduledPosts.bulkPostNowSuccess', { count: succeeded }),
            );
          }
          if (skipped.length > 0 && skippedLabel) {
            toast.info(
              t('digitalMarketing.scheduledPosts.bulkPartialSuccess', {
                succeeded,
                failed: 0,
                skipped: skippedLabel,
              }),
            );
          }
        } else if (succeeded > 0 && failed > 0) {
          toast.warning(
            t('digitalMarketing.scheduledPosts.bulkPartialSuccess', {
              succeeded,
              failed,
              skipped: skippedLabel || '—',
            }),
          );
        } else if (failed > 0) {
          toast.error(t('digitalMarketing.scheduledPosts.bulkAllFailed'));
        }
      } finally {
        setIsBulkRunning(false);
      }
    },
    [targets, scheduleRows, postDateYmd, runPublish, t],
  );

  const handleCancel = async (target: RequiredPlatformAutoTarget, scheduleId: string) => {
    try {
      await cancelMutation.mutateAsync({
        platform: target.platform,
        organizationId,
        scheduleId,
        planId,
      });
      lockAccount(target);
      toast.success(t('digitalMarketing.scheduledPosts.scheduleCancelled'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to cancel');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await deletePublishedMutation.mutateAsync({
        platform: deleteTarget.platform,
        organizationId,
        planId,
        accountId: deleteTarget.accountId,
      });
      setDeleteTarget(null);
    } catch {
      // toast handled in hook
    }
  };

  if (!eligible) return null;
  if (!serviceId) return null;

  if (accountsLoading) {
    return (
      <section className="overflow-hidden rounded-xl border border-border/80 bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('digitalMarketing.scheduledPosts.loadingAccounts', 'Loading connected accounts...')}
        </div>
      </section>
    );
  }

  if (!targets.length) {
    return (
      <section className="overflow-hidden rounded-xl border border-border/80 bg-card p-3 text-sm text-muted-foreground shadow-sm">
        {t('digitalMarketing.scheduledPosts.noRequiredPlatforms')}
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-border/80 bg-card shadow-sm">
      <header className="flex items-center justify-between gap-2 border-b border-border/60 bg-muted/30 px-3 py-2">
        <h3 className="text-sm font-semibold text-foreground">
          {t('digitalMarketing.scheduledPosts.unifiedAutoPost', 'Auto-post')}
        </h3>
      </header>

      <div className="flex flex-col md:flex-row md:items-stretch">
        <div className="flex min-w-0 flex-1 flex-col gap-3 border-b border-border/60 p-3 md:w-1/2 md:shrink-0 md:border-b-0 md:border-r">
          <div className="min-w-0 w-full border border-border/60 bg-muted/30">
            <div className={SCHEDULE_TABLE_SCROLL_CLASS}>
              <div className="min-w-max text-sm">
                <div className={SCHEDULE_TABLE_HEADER_ROW_CLASS}>
                  <div className={SCHEDULE_TABLE_PLATFORM_HEAD_CLASS}>
                    {t('digitalMarketing.scheduledPosts.tablePlatformAccount', 'Platform / Account')}
                  </div>
                  <div className={SCHEDULE_TABLE_MIDDLE_GROUP_CLASS}>
                    <div className={`${SCHEDULE_TABLE_STATUS_CELL_CLASS} ${SCHEDULE_TABLE_MIDDLE_HEAD_CLASS}`}>
                      {t('digitalMarketing.scheduledPosts.tableStatus', 'Status')}
                    </div>
                    <div className={`${SCHEDULE_TABLE_CONNECTION_CELL_CLASS} ${SCHEDULE_TABLE_MIDDLE_HEAD_CLASS}`}>
                      {t('digitalMarketing.scheduledPosts.tableConnection', 'Connection')}
                    </div>
                    <div className={`${SCHEDULE_TABLE_VISIBILITY_CELL_CLASS} ${SCHEDULE_TABLE_MIDDLE_HEAD_CLASS}`}>
                      {t('digitalMarketing.scheduledPosts.privacyLabel', 'Visibility')}
                    </div>
                    <div className={`${SCHEDULE_TABLE_TIME_CELL_CLASS} ${SCHEDULE_TABLE_MIDDLE_HEAD_CLASS}`}>
                      {t('digitalMarketing.scheduledPosts.postTimeLabel', 'Post time (WIB)')}
                    </div>
                  </div>
                  <div className={SCHEDULE_TABLE_ACTIONS_HEAD_CLASS}>
                    {t('digitalMarketing.scheduledPosts.tableActions', 'Actions')}
                  </div>
                </div>
                {targets.map((target) => {
                  const schedule = pickAccountScheduleForModal(
                    scheduleRows,
                    target.platform,
                    target.accountId,
                  );
                  const activeSchedule =
                    schedule &&
                    (schedule.status === 'pending' || schedule.status === 'publishing')
                      ? schedule
                      : null;

                  const rowBusyId = target.requiredPlatformRowId;
                  const isSchedulePending =
                    scheduleMutation.isPending &&
                    scheduleMutation.variables?.accountId === target.accountId &&
                    scheduleMutation.variables?.platform === target.platform;
                  const isPostNowPending =
                    postNowMutation.isPending &&
                    postNowMutation.variables?.accountId === target.accountId &&
                    postNowMutation.variables?.platform === target.platform;
                  const isCancelPending =
                    cancelMutation.isPending &&
                    cancelMutation.variables?.platform === target.platform;
                  const isDeletePending =
                    deletePublishedMutation.isPending &&
                    deleteTarget?.accountId === target.accountId &&
                    deleteTarget?.platform === target.platform;
                  const rowCanDelete = canDeletePublishedPlatformRow(
                    target,
                    schedule,
                    planLinks,
                  );

                  return (
                    <RequiredPlatformScheduleRow
                      key={rowBusyId}
                      target={target}
                      schedule={schedule}
                      activeSchedule={activeSchedule}
                      timeWib={getTimeWib(rowBusyId)}
                      onTimeChange={(value) =>
                        setTimeWibByRowId((prev) => ({ ...prev, [rowBusyId]: value }))
                      }
                      privacyLevel={getPrivacyLevel(rowBusyId, target.platform)}
                      onPrivacyChange={(value) =>
                        setPrivacyByRowId((prev) => ({ ...prev, [rowBusyId]: value }))
                      }
                      onSchedule={() => {
                        void runPublish(target, 'schedule');
                      }}
                      onPostNow={() => {
                        void runPublish(target, 'post_now');
                      }}
                      onCancel={() => activeSchedule && handleCancel(target, activeSchedule.id)}
                      onDelete={() => setDeleteTarget(target)}
                      canDelete={rowCanDelete}
                      isSchedulePending={isSchedulePending}
                      isPostNowPending={isPostNowPending}
                      isCancelPending={isCancelPending}
                      isDeletePending={isDeletePending}
                      bulkRunning={isBulkRunning}
                      reconnectHint={getReconnectHint(target.platform, t)}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-2 border-t border-border/40 pt-3">
            <Label className={fieldLabel}>
              {t('digitalMarketing.scheduledPosts.captionLabel', 'Caption')}
            </Label>
            <Textarea
              value={caption}
              onChange={(e) => onCaptionChange(e.target.value)}
              rows={3}
              className="min-h-[4.5rem] w-full resize-y text-sm"
            />

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                className="h-8"
                disabled={bulkDisabled}
                onClick={() => {
                  void runBulkPublish('schedule');
                }}
              >
                {isBulkRunning ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                {t('digitalMarketing.scheduledPosts.scheduleAll', {
                  count: bulkEligible.length,
                  defaultValue: `Schedule all (${bulkEligible.length})`,
                })}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8"
                disabled={bulkDisabled}
                onClick={() => {
                  void runBulkPublish('post_now');
                }}
              >
                {isBulkRunning ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                {t('digitalMarketing.scheduledPosts.postNowToAll', {
                  count: bulkEligible.length,
                  defaultValue: `Post now to all (${bulkEligible.length})`,
                })}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {t(
                'digitalMarketing.scheduledPosts.bulkActionHint',
                'Only ready platforms without an active schedule are included.',
              )}
            </p>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 shrink-0 flex-col bg-muted/15 px-3 py-2 md:w-1/2">
          <div className="relative aspect-video min-h-[140px] w-full flex-1 overflow-hidden rounded-lg border border-border/80 bg-black shadow-sm">
            {driveValidation.valid ? (
              <div className="absolute inset-0 flex min-h-0 min-w-0 flex-col">
                <GoogleDriveFilePreview link={driveLink} className="min-h-0 flex-1" forceVideo />
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center p-3 text-center text-[11px] text-muted-foreground">
                {driveLink
                  ? driveValidation.error
                  : t('digitalMarketing.scheduledPosts.videoPreviewEmpty')}
              </div>
            )}
          </div>
        </div>
      </div>

      <DeletePublishedConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        platform={deleteTarget?.platform ?? 'YouTube'}
        accountLabel={deleteTarget?.accountLabel ?? ''}
        platformNote={
          deleteTarget?.platform === 'TikTok'
            ? t('digitalMarketing.scheduledPosts.deleteFromPlatformTikTokNote')
            : undefined
        }
        isPending={deletePublishedMutation.isPending}
        onConfirm={() => {
          void handleDeleteConfirm();
        }}
      />
    </section>
  );
}
