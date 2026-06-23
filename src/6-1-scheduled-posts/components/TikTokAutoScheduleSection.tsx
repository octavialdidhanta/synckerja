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
import { useTikTokContentSettings } from '@/tiktok-content/hooks/useTikTokContentSettings';
import { getTikTokAccountDisplayLabel } from '@/tiktok-content/lib/tiktokAccountDisplayLabel';
import {
  useCancelScheduleMutation,
  usePostNowMutation,
  useSchedulePostMutation,
  useTikTokScheduleForPlan,
} from '../hooks/useScheduledPostsByPlan';
import { useOrgDefaultPostTime } from '../hooks/useOrgDefaultPostTime';
import { resolveScheduledAtUtc, formatTimeWibFromUtc } from '../lib/resolveScheduledAtUtc';
import { ScheduleStatusBadge } from './ScheduleStatusBadge';
import type { ScheduledPost } from '../types/scheduled-post';
import { GoogleDriveFilePreview } from '@/6-1-dashboard/modal/GoogleDriveInAppFilePreview';
import { validateGoogleDriveVideoLink } from '../lib/validateGoogleDriveVideoLink';

const QUICK_TIMES = ['12:00', '15:00', '18:00', '20:00'];

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
};

export function TikTokAutoScheduleSection({
  organizationId,
  planId,
  planTitle,
  postDate,
  caption,
  onCaptionChange,
  googleDriveLink,
  employeeId,
  eligible,
}: Props) {
  const { t } = useTranslation();
  const { data: tiktokSettings } = useTikTokContentSettings(organizationId);
  const { data: defaultTime } = useOrgDefaultPostTime();
  const { activeTikTokSchedule, tiktokSchedule } = useTikTokScheduleForPlan(planId);
  const scheduleMutation = useSchedulePostMutation();
  const postNowMutation = usePostNowMutation();
  const cancelMutation = useCancelScheduleMutation();

  const accounts = useMemo(
    () => (tiktokSettings?.accounts ?? []).filter((a) => a.is_active),
    [tiktokSettings?.accounts],
  );

  const defaultAccount = accounts.find((a) => a.is_default) ?? accounts[0];
  const [openId, setOpenId] = useState(defaultAccount?.open_id ?? '');
  const [timeWib, setTimeWib] = useState(defaultTime ?? '18:00');

  useEffect(() => {
    if (defaultAccount?.open_id && !openId) setOpenId(defaultAccount.open_id);
  }, [defaultAccount?.open_id, openId]);

  useEffect(() => {
    if (defaultTime) setTimeWib(defaultTime);
  }, [defaultTime]);

  const selectedAccount = accounts.find((a) => a.open_id === openId);
  const publishScopesOk = selectedAccount?.publish_scopes_granted !== false;

  const postDateYmd = postDate?.slice(0, 10) ?? '';
  const driveLink = googleDriveLink?.trim() ?? '';
  const driveValidation = useMemo(() => validateGoogleDriveVideoLink(driveLink), [driveLink]);
  const isBusy = scheduleMutation.isPending || postNowMutation.isPending || cancelMutation.isPending;

  const runPublish = async (action: 'schedule' | 'post_now') => {
    if (!eligible) {
      toast.error('Content is not ready for TikTok auto-post');
      return;
    }
    if (!openId) {
      toast.error('Select a TikTok account');
      return;
    }
    if (!postDateYmd) {
      toast.error('Post date is required');
      return;
    }

    const accountLabel = getTikTokAccountDisplayLabel(selectedAccount ?? { open_id: openId, label: 'TikTok' });
    const scheduledAtIso =
      action === 'post_now'
        ? new Date().toISOString()
        : resolveScheduledAtUtc(postDateYmd, timeWib);

    if (!scheduledAtIso && action === 'schedule') {
      toast.error('Invalid schedule time');
      return;
    }

    try {
      if (action === 'schedule') {
        await scheduleMutation.mutateAsync({
          organizationId,
          planId,
          openId,
          accountLabel,
          scheduledAtIso: scheduledAtIso!,
          caption,
          title: planTitle ?? undefined,
          employeeId,
        });
        toast.success(t('digitalMarketing.scheduledPosts.scheduledFor', { time: timeWib }));
      } else {
        await postNowMutation.mutateAsync({
          organizationId,
          planId,
          openId,
          accountLabel,
          caption,
          title: planTitle ?? undefined,
          employeeId,
        });
        toast.success(t('digitalMarketing.scheduledPosts.published'));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('digitalMarketing.scheduledPosts.publishFailed'));
    }
  };

  const handleCancel = async (schedule: ScheduledPost) => {
    try {
      await cancelMutation.mutateAsync({
        organizationId,
        scheduleId: schedule.id,
        planId,
      });
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
        <h3 className="text-sm font-semibold text-foreground">
          {t('digitalMarketing.scheduledPosts.tiktokAutoPost')}
        </h3>
        {tiktokSchedule ? <ScheduleStatusBadge status={tiktokSchedule.status} /> : null}
      </header>

      {!publishScopesOk ? (
        <p className="border-b border-border/40 px-3 py-2 text-xs text-destructive">
          {t('digitalMarketing.scheduledPosts.reconnectPublishScopes')}
        </p>
      ) : null}

      {accounts.length === 0 ? (
        <p className="p-3 text-sm text-muted-foreground">
          {t('digitalMarketing.scheduledPosts.connectTikTokAccount', 'Connect a TikTok account in settings.')}
        </p>
      ) : (
        <div className="flex flex-col md:flex-row md:items-start">
          {/* Left — setup publish */}
          <div className="flex min-w-0 flex-1 flex-col gap-2.5 border-b border-border/60 p-3 md:w-1/2 md:border-b-0 md:border-r">
            <p className={fieldLabel}>
              {t('digitalMarketing.scheduledPosts.setupPublish', 'Setup publish')}
            </p>

            <div className="space-y-1">
              <Label className={fieldLabel}>
                {t('digitalMarketing.scheduledPosts.accountLabel', 'Account')}
              </Label>
              <Select value={openId} onValueChange={setOpenId}>
                <SelectTrigger className="h-9 w-full text-sm">
                  <SelectValue placeholder={t('digitalMarketing.scheduledPosts.selectAccount', 'Select account')} />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.open_id} value={acc.open_id}>
                      {getTikTokAccountDisplayLabel(acc)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className={fieldLabel}>
                {t('digitalMarketing.scheduledPosts.postDateLabel', 'Post date')}
              </Label>
              <Input value={postDateYmd} readOnly className="h-9 w-full bg-muted/40 text-sm" />
            </div>

            <div className="space-y-1">
              <Label className={fieldLabel}>
                {t('digitalMarketing.scheduledPosts.postTimeLabel', 'Post time (WIB)')}
              </Label>
              <div className="flex flex-wrap items-center gap-1.5">
                <Input
                  type="time"
                  value={timeWib}
                  onChange={(e) => setTimeWib(e.target.value.slice(0, 5))}
                  className="h-8 w-[7.5rem] text-sm"
                  disabled={Boolean(activeTikTokSchedule)}
                />
                {QUICK_TIMES.map((qt) => (
                  <Button
                    key={qt}
                    type="button"
                    size="sm"
                    variant={timeWib === qt ? 'secondary' : 'outline'}
                    className="h-8 px-2.5 text-xs"
                    disabled={Boolean(activeTikTokSchedule)}
                    onClick={() => setTimeWib(qt)}
                  >
                    {qt}
                  </Button>
                ))}
              </div>
              {activeTikTokSchedule ? (
                <p className="text-[11px] text-muted-foreground">
                  {t('digitalMarketing.scheduledPosts.activeScheduleHint', {
                    time: formatTimeWibFromUtc(activeTikTokSchedule.scheduled_at),
                    defaultValue: 'Scheduled for {{time}} WIB',
                  })}
                </p>
              ) : null}
            </div>

            <div className="space-y-1">
              <Label className={fieldLabel}>
                {t('digitalMarketing.scheduledPosts.captionLabel', 'Caption')}
              </Label>
              <Textarea
                value={caption}
                onChange={(e) => onCaptionChange(e.target.value)}
                rows={2}
                className="min-h-[4.5rem] w-full resize-y text-sm"
              />
            </div>

            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {!activeTikTokSchedule ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8"
                    disabled={isBusy || !publishScopesOk}
                    onClick={() => runPublish('schedule')}
                  >
                    {scheduleMutation.isPending ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : null}
                    {t('digitalMarketing.scheduledPosts.schedule')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8"
                    disabled={isBusy || !publishScopesOk}
                    onClick={() => runPublish('post_now')}
                  >
                    {postNowMutation.isPending ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : null}
                    {t('digitalMarketing.scheduledPosts.postNow')}
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8"
                  disabled={isBusy}
                  onClick={() => handleCancel(activeTikTokSchedule)}
                >
                  {t('digitalMarketing.scheduledPosts.cancelSchedule')}
                </Button>
              )}
              {tiktokSchedule?.status === 'failed' ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-8"
                  disabled={isBusy || !publishScopesOk}
                  onClick={() => runPublish('post_now')}
                >
                  {t('digitalMarketing.scheduledPosts.retryPostNow')}
                </Button>
              ) : null}
            </div>

            {tiktokSchedule?.error_message ? (
              <p
                className={`line-clamp-2 text-[11px] leading-snug ${
                  tiktokSchedule.status === 'pending'
                    ? 'text-amber-700 dark:text-amber-400'
                    : 'text-destructive'
                }`}
              >
                {tiktokSchedule.status === 'pending'
                  ? t(
                      'digitalMarketing.scheduledPosts.scheduleRetrying',
                      'Publish delayed — retrying automatically. {{error}}',
                      { error: tiktokSchedule.error_message },
                    )
                  : tiktokSchedule.error_message}
              </p>
            ) : null}
          </div>

          {/* Right — landscape preview (same pattern as Google Drive link modal) */}
          <div className="flex min-w-0 flex-1 flex-col bg-muted/15 px-3 py-2 md:w-1/2">
            <p className={`mb-1 ${fieldLabel}`}>
              {t('digitalMarketing.scheduledPosts.videoPreview', 'Video preview')}
            </p>
            <div className="relative w-full overflow-hidden rounded-lg border border-border/80 bg-black shadow-sm aspect-video min-h-[140px]">
              {driveValidation.valid ? (
                <div className="absolute inset-0 flex min-h-0 min-w-0 flex-col">
                  <GoogleDriveFilePreview link={driveLink} className="min-h-0 flex-1" forceVideo />
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center p-3 text-center text-[11px] leading-snug text-muted-foreground">
                  {driveLink
                    ? (driveValidation.error ??
                      t('digitalMarketing.scheduledPosts.videoPreviewInvalid', 'Invalid video link'))
                    : t('digitalMarketing.scheduledPosts.videoPreviewEmpty', 'No Google Drive video linked')}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
