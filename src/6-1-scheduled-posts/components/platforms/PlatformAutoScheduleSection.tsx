import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Input } from '@/shared/components/ui/input';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useOrgDefaultPostTime } from '../../hooks/useOrgDefaultPostTime';
import { resolveScheduledAtUtc, formatTimeWibFromUtc } from '../../lib/resolveScheduledAtUtc';
import { ScheduleStatusBadge } from '../ScheduleStatusBadge';
import type { ScheduledPost } from '../../types/scheduled-post';
import { GoogleDriveFilePreview } from '@/6-1-dashboard/modal/GoogleDriveInAppFilePreview';
import { validateGoogleDriveVideoLink } from '../../lib/validateGoogleDriveVideoLink';
import {
  usePlatformScheduleMutations,
  type PlatformPublishFunction,
} from '../../hooks/usePlatformScheduleMutations';

const QUICK_TIMES = ['12:00', '15:00', '18:00', '20:00'];

export type PlatformScheduleAccount = {
  id: string;
  label: string;
  publishScopesOk?: boolean;
};

type Props = {
  platform: string;
  title: string;
  edgeFunction: PlatformPublishFunction;
  organizationId: string;
  planId: string;
  planTitle: string | null;
  postDate: string | null;
  caption: string;
  onCaptionChange: (value: string) => void;
  googleDriveLink?: string | null;
  employeeId?: string;
  eligible: boolean;
  accounts: PlatformScheduleAccount[];
  schedule: ScheduledPost | null;
  activeSchedule: ScheduledPost | null;
  buildPublishBody: (args: {
    accountId: string;
    accountLabel: string;
    scheduledAtIso?: string;
    caption: string;
    title?: string;
    employeeId?: string;
    privacyLevel?: string;
  }) => Record<string, unknown>;
  reconnectHint?: string;
  emptyAccountsHint?: string;
  privacyConfig?: {
    options: { value: string; label: string }[];
    defaultValue: string;
    lockedHintKey?: string;
  };
};

export function PlatformAutoScheduleSection({
  platform,
  title,
  edgeFunction,
  organizationId,
  planId,
  planTitle,
  postDate,
  caption,
  onCaptionChange,
  googleDriveLink,
  employeeId,
  eligible,
  accounts,
  schedule,
  activeSchedule,
  buildPublishBody,
  reconnectHint,
  emptyAccountsHint,
  privacyConfig,
}: Props) {
  const { t } = useTranslation();
  const { data: defaultTime } = useOrgDefaultPostTime();
  const { scheduleMutation, postNowMutation, cancelMutation } =
    usePlatformScheduleMutations(edgeFunction);

  const defaultAccount = accounts[0];
  const [accountId, setAccountId] = useState(defaultAccount?.id ?? '');
  const [timeWib, setTimeWib] = useState(defaultTime ?? '18:00');
  const [privacyLevel, setPrivacyLevel] = useState(privacyConfig?.defaultValue ?? 'PUBLIC');

  const resolveStoredPrivacyLevel = (raw: string | null | undefined): string => {
    if (!privacyConfig) return privacyLevel;
    const normalized = String(raw ?? '').trim().toUpperCase();
    if (privacyConfig.options.some((o) => o.value === normalized)) return normalized;
    if (normalized === 'SELF_ONLY') return 'PRIVATE';
    return privacyConfig.defaultValue;
  };

  const lockedPrivacyLevel = activeSchedule
    ? resolveStoredPrivacyLevel(activeSchedule.privacy_level)
    : null;
  const displayPrivacyLevel = lockedPrivacyLevel ?? privacyLevel;
  const privacyLocked = Boolean(activeSchedule);

  useEffect(() => {
    if (privacyConfig?.defaultValue && !activeSchedule) {
      setPrivacyLevel(privacyConfig.defaultValue);
    }
  }, [privacyConfig?.defaultValue, activeSchedule]);

  useEffect(() => {
    if (defaultAccount?.id && !accountId) setAccountId(defaultAccount.id);
  }, [defaultAccount?.id, accountId]);

  useEffect(() => {
    if (defaultTime) setTimeWib(defaultTime);
  }, [defaultTime]);

  const selectedAccount = accounts.find((a) => a.id === accountId);
  const publishScopesOk = selectedAccount?.publishScopesOk !== false;
  const postDateYmd = postDate?.slice(0, 10) ?? '';
  const driveLink = googleDriveLink?.trim() ?? '';
  const driveValidation = useMemo(() => validateGoogleDriveVideoLink(driveLink), [driveLink]);
  const isBusy = scheduleMutation.isPending || postNowMutation.isPending || cancelMutation.isPending;
  const isRateLimitQueue =
    schedule?.status === 'pending' && Boolean(schedule.error_message?.startsWith('rate_limited:'));

  const runPublish = async (action: 'schedule' | 'post_now') => {
    if (!eligible) {
      toast.error(`${platform} auto-post is not ready`);
      return;
    }
    if (!accountId) {
      toast.error('Select an account');
      return;
    }
    if (!postDateYmd) {
      toast.error('Post date is required');
      return;
    }

    const accountLabel = selectedAccount?.label ?? platform;
    const scheduledAtIso =
      action === 'post_now' ? new Date().toISOString() : resolveScheduledAtUtc(postDateYmd, timeWib);

    if (!scheduledAtIso && action === 'schedule') {
      toast.error('Invalid schedule time');
      return;
    }

    const base = {
      organization_id: organizationId,
      social_media_plan_id: planId,
      ...buildPublishBody({
        accountId,
        accountLabel,
        scheduledAtIso: scheduledAtIso ?? undefined,
        caption,
        title: planTitle ?? undefined,
        employeeId,
        ...(privacyConfig ? { privacyLevel: displayPrivacyLevel } : {}),
      }),
    };

    try {
      if (action === 'schedule') {
        await scheduleMutation.mutateAsync(base);
        toast.success(t('digitalMarketing.scheduledPosts.scheduledFor', { time: timeWib }));
      } else {
        await postNowMutation.mutateAsync(base);
        toast.success(t('digitalMarketing.scheduledPosts.publishedPlatform', { platform }));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('digitalMarketing.scheduledPosts.publishFailed'));
    }
  };

  const handleCancel = async (row: ScheduledPost) => {
    try {
      await cancelMutation.mutateAsync({ organizationId, scheduleId: row.id, planId });
      toast.success(t('digitalMarketing.scheduledPosts.scheduleCancelled'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to cancel');
    }
  };

  if (!eligible) return null;

  const fieldLabel = 'text-[11px] font-medium uppercase tracking-wide text-muted-foreground';

  return (
    <section className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm">
      <header className="flex items-center justify-between gap-2 border-b border-border/60 bg-muted/30 px-3 py-2">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {schedule ? <ScheduleStatusBadge status={schedule.status} /> : null}
      </header>

      {!publishScopesOk && reconnectHint ? (
        <p className="border-b border-border/40 px-3 py-2 text-xs text-destructive">{reconnectHint}</p>
      ) : null}

      {accounts.length === 0 ? (
        <p className="p-3 text-sm text-muted-foreground">{emptyAccountsHint}</p>
      ) : (
        <div className="flex flex-col md:flex-row md:items-start">
          <div className="flex min-w-0 flex-1 flex-col gap-2.5 border-b border-border/60 p-3 md:w-1/2 md:border-b-0 md:border-r">
            <div className="space-y-1">
              <Label className={fieldLabel}>{t('digitalMarketing.scheduledPosts.accountLabel', 'Account')}</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger className="h-9 w-full text-sm">
                  <SelectValue placeholder={t('digitalMarketing.scheduledPosts.selectAccount', 'Select account')} />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {privacyConfig ? (
              <div className="space-y-1">
                <Label className={fieldLabel}>
                  {t('digitalMarketing.scheduledPosts.privacyLabel', 'Visibility')}
                </Label>
                <Select
                  value={displayPrivacyLevel}
                  onValueChange={setPrivacyLevel}
                  disabled={privacyLocked}
                >
                  <SelectTrigger className="h-9 w-full text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {privacyConfig.options.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {privacyLocked && privacyConfig.lockedHintKey ? (
                  <p className="text-[11px] text-muted-foreground">
                    {t(
                      privacyConfig.lockedHintKey,
                      'Visibility is locked. Cancel the schedule to change it.',
                    )}
                  </p>
                ) : null}
                {!privacyLocked && schedule?.privacy_level && schedule.status !== 'cancelled' ? (
                  <p className="text-[11px] text-muted-foreground">
                    {t('digitalMarketing.scheduledPosts.lastPrivacyLabel', 'Last publish visibility')}:{' '}
                    {privacyConfig.options.find(
                      (o) => o.value === resolveStoredPrivacyLevel(schedule.privacy_level),
                    )?.label ?? schedule.privacy_level}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="space-y-1">
              <Label className={fieldLabel}>{t('digitalMarketing.scheduledPosts.postTimeLabel', 'Post time (WIB)')}</Label>
              <div className="flex flex-wrap items-center gap-1.5">
                <Input
                  type="time"
                  value={timeWib}
                  onChange={(e) => setTimeWib(e.target.value.slice(0, 5))}
                  className="h-8 w-[7.5rem] text-sm"
                  disabled={Boolean(activeSchedule)}
                />
                {QUICK_TIMES.map((qt) => (
                  <Button
                    key={qt}
                    type="button"
                    size="sm"
                    variant={timeWib === qt ? 'secondary' : 'outline'}
                    className="h-8 px-2.5 text-xs"
                    disabled={Boolean(activeSchedule)}
                    onClick={() => setTimeWib(qt)}
                  >
                    {qt}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <Label className={fieldLabel}>{t('digitalMarketing.scheduledPosts.captionLabel', 'Caption')}</Label>
              <Textarea
                value={caption}
                onChange={(e) => onCaptionChange(e.target.value)}
                rows={2}
                className="min-h-[4.5rem] w-full resize-y text-sm"
              />
            </div>

            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {!activeSchedule ? (
                <>
                  <Button type="button" size="sm" className="h-8" disabled={isBusy || !publishScopesOk} onClick={() => runPublish('schedule')}>
                    {scheduleMutation.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                    {t('digitalMarketing.scheduledPosts.schedule')}
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="h-8" disabled={isBusy || !publishScopesOk} onClick={() => runPublish('post_now')}>
                    {postNowMutation.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                    {t('digitalMarketing.scheduledPosts.postNow')}
                  </Button>
                </>
              ) : (
                <Button type="button" size="sm" variant="outline" className="h-8" disabled={isBusy} onClick={() => handleCancel(activeSchedule)}>
                  {t('digitalMarketing.scheduledPosts.cancelSchedule')}
                </Button>
              )}
            </div>

            {schedule?.error_message ? (
              <p className={`line-clamp-2 text-[11px] leading-snug ${isRateLimitQueue ? 'text-sky-700 dark:text-sky-400' : 'text-destructive'}`}>
                {schedule.error_message}
              </p>
            ) : null}
          </div>

          <div className="flex min-w-0 flex-1 flex-col bg-muted/15 px-3 py-2 md:w-1/2">
            <div className="relative w-full overflow-hidden rounded-lg border border-border/80 bg-black shadow-sm aspect-video min-h-[140px]">
              {driveValidation.valid ? (
                <div className="absolute inset-0 flex min-h-0 min-w-0 flex-col">
                  <GoogleDriveFilePreview link={driveLink} className="min-h-0 flex-1" forceVideo />
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center p-3 text-center text-[11px] text-muted-foreground">
                  {driveLink ? driveValidation.error : t('digitalMarketing.scheduledPosts.videoPreviewEmpty')}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
