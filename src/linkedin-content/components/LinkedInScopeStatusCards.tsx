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
  pages: '/digital-marketing/social-media-performance/linkedin/settings',
};

export function LinkedInScopeStatusCards({ accounts }: LinkedInScopeStatusCardsProps) {
  const { t } = useTranslation();
  if (accounts.length === 0) return null;

  const primary = accounts.find((a) => a.is_default) ?? accounts[0];
  const granted = parseLinkedInGrantedScopes(primary.granted_scopes);
  const features = Object.keys(LINKEDIN_SCOPE_FEATURE_MAP) as Array<
    keyof typeof LINKEDIN_SCOPE_FEATURE_MAP
  >;

  return (
    <div className="space-y-2 border-t border-slate-200 pt-4">
      <p className="text-xs font-medium text-slate-700">
        {t('digitalMarketing.linkedinContent.scopeStatus.title', 'LinkedIn permissions status')}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {features.map((feature) => {
          const missing = missingLinkedInScopesForFeature(granted, feature);
          const ok = missing.length === 0;
          const labels: Record<typeof feature, string> = {
            comments: t('digitalMarketing.linkedinContent.scopeStatus.comments', 'Comments'),
            insights: t('digitalMarketing.linkedinContent.scopeStatus.insights', 'Insights'),
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
                {!ok && (
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
      {granted.length === 0 && (
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
