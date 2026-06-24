import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLinkedInContentSettings } from '@/linkedin-content/hooks/useLinkedInContentSettings';
import { missingLinkedInScopesForFeature } from '@/linkedin-content/constants/linkedinOAuthScopes';
import {
  useScheduledPostsByPlan,
  pickLinkedInScheduleForModal,
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

export function LinkedInAutoScheduleSection(props: Props) {
  const { t } = useTranslation();
  const { data: settings } = useLinkedInContentSettings(props.organizationId);
  const { data: schedules } = useScheduledPostsByPlan(props.planId);
  const linkedinSchedule = pickLinkedInScheduleForModal(schedules ?? []);
  const activeSchedule =
    schedules?.find(
      (s) => s.platform === 'LinkedIn' && (s.status === 'pending' || s.status === 'publishing'),
    ) ?? null;

  const accounts = useMemo(
    () =>
      (settings?.accounts ?? [])
        .filter((a) => a.is_active)
        .map((a) => ({
          id: a.page_id,
          label: a.display_name || a.label || a.page_id,
          publishScopesOk:
            missingLinkedInScopesForFeature(
              Array.isArray(a.granted_scopes) ? a.granted_scopes : [],
              'publish',
            ).length === 0,
        })),
    [settings?.accounts],
  );

  return (
    <PlatformAutoScheduleSection
      platform="LinkedIn"
      title={t('digitalMarketing.scheduledPosts.linkedinAutoPost', 'LinkedIn auto-post')}
      edgeFunction="linkedin-content-publish"
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
      schedule={linkedinSchedule}
      activeSchedule={activeSchedule}
      reconnectHint={t(
        'digitalMarketing.scheduledPosts.linkedinReconnectPublish',
        'Reconnect LinkedIn to grant w_organization_social.',
      )}
      emptyAccountsHint={t(
        'digitalMarketing.scheduledPosts.connectLinkedInAccount',
        'Connect a LinkedIn company page in settings.',
      )}
      buildPublishBody={({ accountId, accountLabel, scheduledAtIso, caption, title, employeeId }) => ({
        page_id: accountId,
        account_label: accountLabel,
        scheduled_at: scheduledAtIso,
        caption,
        title,
        employee_id: employeeId ?? null,
      })}
    />
  );
}
