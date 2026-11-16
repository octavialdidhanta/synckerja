import { Link } from 'react-router-dom';
import { CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  LINKEDIN_SCOPE_FEATURE_MAP,
  missingLinkedInScopesForFeature,
  parseLinkedInGrantedScopes,
} from '@/linkedin-content/constants/linkedinOAuthScopes';
import type { LinkedInContentAccountRow } from '@/linkedin-content/hooks/useLinkedInContentSettings';
import { cn } from '@/shared/lib/utils';

type LinkedInScopeStatusCardsProps = {
  accounts: LinkedInContentAccountRow[];
};

const FEATURE_LINKS: Record<keyof typeof LINKEDIN_SCOPE_FEATURE_MAP, string> = {
  comments: '/digital-marketing/social-media-performance/manage-comments/linkedin',
  insights: '/digital-marketing/social-media-performance/linkedin',
  publish: '/digital-marketing/social-media/content-calendar',
  memberPublish: '/digital-marketing/social-media-performance/linkedin/settings',
  memberInsights: '/digital-marketing/social-media-performance/linkedin',
  pages: '/digital-marketing/social-media-performance/linkedin/settings',
};

const MEMBER_FEATURES = new Set<keyof typeof LINKEDIN_SCOPE_FEATURE_MAP>([
  'memberPublish',
  'memberInsights',
]);

export function LinkedInScopeStatusCards({ accounts }: LinkedInScopeStatusCardsProps) {
  const { t } = useTranslation();
  if (accounts.length === 0) return null;

  const orgPrimary =
    accounts.find((a) => a.is_default && String(a.account_kind ?? 'organization') !== 'person') ??
    accounts.find((a) => String(a.account_kind ?? 'organization') !== 'person') ??
    accounts[0];
  const personPrimary =
    accounts.find((a) => a.account_kind === 'person' && a.is_default) ??
    accounts.find((a) => a.account_kind === 'person') ??
    null;

  const orgGranted = parseLinkedInGrantedScopes(orgPrimary.granted_scopes);
  const personGranted = parseLinkedInGrantedScopes(personPrimary?.granted_scopes);
  const hasPersonAccount = Boolean(personPrimary);

  const features = (
    Object.keys(LINKEDIN_SCOPE_FEATURE_MAP) as Array<keyof typeof LINKEDIN_SCOPE_FEATURE_MAP>
  ).filter((feature) => !MEMBER_FEATURES.has(feature) || hasPersonAccount);

  return (
    <div className="space-y-2 border-t border-slate-200 pt-4">
      <p className="text-xs font-medium text-slate-700">
        {t('digitalMarketing.linkedinContent.scopeStatus.title', 'LinkedIn permissions status')}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {features.map((feature) => {
          const granted = MEMBER_FEATURES.has(feature) ? personGranted : orgGranted;
          const missing = missingLinkedInScopesForFeature(granted, feature);
          const ok = missing.length === 0;
          const labels: Record<typeof feature, string> = {
            comments: t('digitalMarketing.linkedinContent.scopeStatus.comments', 'Comments'),
            insights: t('digitalMarketing.linkedinContent.scopeStatus.insights', 'Insights'),
            publish: t('digitalMarketing.linkedinContent.scopeStatus.publish', 'Publish'),
            memberPublish: t(
              'digitalMarketing.linkedinContent.scopeStatus.memberPublish',
              'Personal publish',
            ),
            memberInsights: t(
              'digitalMarketing.linkedinContent.scopeStatus.memberInsights',
              'Personal insights',
            ),
            pages: t('digitalMarketing.linkedinContent.scopeStatus.pages', 'Pages'),
          };
          return (
            <div
              key={feature}
              className={cn(
                'flex items-start gap-2 rounded-lg border px-3 py-2 text-xs',
                ok ? 'border-emerald-200 bg-emerald-50/60' : 'border-amber-200 bg-amber-50/60',
              )}
            >
              {ok ? (
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-800">{labels[feature]}</p>
                {!ok && feature === 'memberInsights' && (
                  <p className="mt-0.5 text-slate-600">
                    {t(
                      'digitalMarketing.linkedinContent.scopeStatus.memberInsightsBlocked',
                      'Not available on this LinkedIn app yet (Auth rejects these scopes). Personal stays publish-only.',
                    )}
                  </p>
                )}
                {!ok && feature !== 'memberInsights' && (
                  <p className="mt-0.5 text-slate-600">
                    {t('digitalMarketing.linkedinContent.scopeStatus.missing', 'Missing')}:{' '}
                    {missing.join(', ')}
                  </p>
                )}
                {ok && feature !== 'pages' && (
                  <Link
                    to={FEATURE_LINKS[feature]}
                    className="mt-1 inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    {t('digitalMarketing.linkedinContent.scopeStatus.open', 'Open')}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {orgGranted.length === 0 && personGranted.length === 0 && (
        <p className="text-xs text-amber-700">
          {t(
            'digitalMarketing.linkedinContent.scopeStatus.reconnectHint',
            'Reconnect LinkedIn to refresh permission status.',
          )}
        </p>
      )}
    </div>
  );
}
