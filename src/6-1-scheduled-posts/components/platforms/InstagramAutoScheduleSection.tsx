import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useMetaContentConfig } from '@/meta-content/hooks/useMetaContentConfig';
import { instagramPublishScopesOk } from '@/meta-platform/constants/metaOAuthScopes';
import {
  useScheduledPostsByPlan,
  pickInstagramScheduleForModal,
} from '../../hooks/useScheduledPostsByPlan';
import { PlatformAutoScheduleSection } from './PlatformAutoScheduleSection';

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

export function InstagramAutoScheduleSection(props: Props) {
  const { t } = useTranslation();
  const { data: config } = useMetaContentConfig(props.organizationId);
  const { data: schedules } = useScheduledPostsByPlan(props.planId);
  const instagramSchedule = pickInstagramScheduleForModal(schedules ?? []);
  const activeSchedule =
    schedules?.find(
      (s) => s.platform === 'Instagram' && (s.status === 'pending' || s.status === 'publishing'),
    ) ?? null;

  const accounts = useMemo(
    () =>
      (config?.accounts ?? [])
        .filter((a) => a.platform === 'instagram')
        .map((a) => ({
          id: a.account_id,
          label: a.account_label || a.account_id,
          publishScopesOk: instagramPublishScopesOk(a.granted_scopes ?? []),
        })),
    [config?.accounts],
  );

  return (
    <PlatformAutoScheduleSection
      platform="Instagram"
      title={t('digitalMarketing.scheduledPosts.instagramAutoPost', 'Instagram Reels auto-post')}
      edgeFunction="meta-content-publish"
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
      schedule={instagramSchedule}
      activeSchedule={activeSchedule}
      reconnectHint={t(
        'digitalMarketing.scheduledPosts.instagramReconnectPublish',
        'Reconnect Instagram to grant instagram_content_publish.',
      )}
      emptyAccountsHint={t(
        'digitalMarketing.scheduledPosts.connectInstagramAccount',
        'Connect an Instagram Business account in settings.',
      )}
      buildPublishBody={({ accountId, accountLabel, scheduledAtIso, caption, title, employeeId }) => ({
        instagram_business_account_id: accountId,
        account_label: accountLabel,
        scheduled_at: scheduledAtIso,
        caption,
        title,
        employee_id: employeeId ?? null,
      })}
    />
  );
}
