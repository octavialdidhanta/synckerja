import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useYouTubeContentSettings } from '@/youtube-content/hooks/useYouTubeContentSettings';
import {
  useScheduledPostsByPlan,
  pickYouTubeScheduleForModal,
} from '../../hooks/useScheduledPostsByPlan';
import { PlatformAutoScheduleSection } from './PlatformAutoScheduleSection';
import {
  DEFAULT_YOUTUBE_SCHEDULE_PRIVACY,
  YOUTUBE_SCHEDULE_PRIVACY_LEVELS,
} from '../../lib/youtubeSchedulePrivacy';

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

export function YouTubeAutoScheduleSection(props: Props) {
  const { t } = useTranslation();
  const { data: settings } = useYouTubeContentSettings(props.organizationId);
  const { data: schedules } = useScheduledPostsByPlan(props.planId);
  const youtubeSchedule = pickYouTubeScheduleForModal(schedules ?? []);
  const activeSchedule =
    schedules?.find(
      (s) => s.platform === 'YouTube' && (s.status === 'pending' || s.status === 'publishing'),
    ) ?? null;

  const accounts = useMemo(
    () =>
      (settings?.accounts ?? [])
        .filter((a) => a.is_active)
        .map((a) => ({
          id: a.channel_id,
          label: a.display_name || a.label || a.channel_id,
          publishScopesOk: a.upload_scopes_granted !== false,
        })),
    [settings?.accounts],
  );

  const privacyOptions = useMemo(
    () =>
      YOUTUBE_SCHEDULE_PRIVACY_LEVELS.map((value) => ({
        value,
        label:
          value === 'PUBLIC'
            ? t('digitalMarketing.youtubeContent.privacy.public', 'Public')
            : value === 'UNLISTED'
              ? t('digitalMarketing.youtubeContent.privacy.unlisted', 'Unlisted')
              : t('digitalMarketing.youtubeContent.privacy.private', 'Private'),
      })),
    [t],
  );

  return (
    <PlatformAutoScheduleSection
      platform="YouTube"
      title={t('digitalMarketing.scheduledPosts.youtubeAutoPost', 'YouTube auto-post')}
      edgeFunction="youtube-content-publish"
      organizationId={props.organizationId}
      planId={props.planId}
      planTitle={props.planTitle}
      postDate={props.postDate}
      caption={props.caption}
      onCaptionChange={props.onCaptionChange}
      googleDriveLink={props.googleDriveLink}
      employeeId={props.employeeId}
      eligible={props.eligible}
      accounts={accounts}
      schedule={youtubeSchedule}
      activeSchedule={activeSchedule}
      reconnectHint={t(
        'digitalMarketing.scheduledPosts.youtubeReconnectUpload',
        'Reconnect YouTube to grant upload scope (youtube.upload).',
      )}
      emptyAccountsHint={t(
        'digitalMarketing.scheduledPosts.connectYouTubeAccount',
        'Connect a YouTube channel in settings.',
      )}
      privacyConfig={{
        options: privacyOptions,
        defaultValue: DEFAULT_YOUTUBE_SCHEDULE_PRIVACY,
        lockedHintKey: 'digitalMarketing.scheduledPosts.privacyLockedHint',
      }}
      buildPublishBody={({ accountId, accountLabel, scheduledAtIso, caption, title, employeeId, privacyLevel }) => ({
        channel_id: accountId,
        account_label: accountLabel,
        scheduled_at: scheduledAtIso,
        caption,
        title,
        employee_id: employeeId ?? null,
        privacy_level: privacyLevel ?? DEFAULT_YOUTUBE_SCHEDULE_PRIVACY,
      })}
    />
  );
}
