import { Link } from 'react-router-dom';
import { CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import {
  META_SCOPE_FEATURE_MAP,
  missingScopesForFeature,
} from '@/meta-platform/constants/metaOAuthScopes';
import type { InstagramAccountRow } from '@/5-3-whatsapp/hooks/useInstagramAccounts';
import { cn } from '@/shared/lib/utils';

type MetaScopeStatusCardsProps = {
  accounts: InstagramAccountRow[];
};

function parseGrantedScopes(account: InstagramAccountRow): string[] {
  const raw = account.granted_scopes;
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return [];
    }
  }
  return [];
}

const FEATURE_LINKS: Record<keyof typeof META_SCOPE_FEATURE_MAP, string> = {
  dm: '/omnichannel/livechat',
  comments: '/digital-marketing/social-media-performance/manage-comments/instagram',
  insights: '/digital-marketing/social-media-performance/instagram',
  pages: '/omnichannel/integrations/instagram',
  threads_insights: '/digital-marketing/social-media-performance/threads',
  threads_replies: '/digital-marketing/social-media-performance/manage-comments/threads',
};

export function MetaScopeStatusCards({ accounts }: MetaScopeStatusCardsProps) {
  const { t } = useAppTranslation();
  if (accounts.length === 0) return null;

  const primary = accounts[0];
  const granted = parseGrantedScopes(primary);
  const features = Object.keys(META_SCOPE_FEATURE_MAP) as Array<keyof typeof META_SCOPE_FEATURE_MAP>;

  return (
    <div className="space-y-2 border-t border-slate-200 pt-4">
      <p className="text-xs font-medium text-slate-700">
        {t('metaPlatform.scopeStatus.title', 'Meta permissions status')}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {features.map((feature) => {
          const missing = missingScopesForFeature(granted, feature);
          const ok = missing.length === 0;
          const labels: Record<typeof feature, string> = {
            dm: t('metaPlatform.scopeStatus.dm', 'DM Live Chat'),
            comments: t('metaPlatform.scopeStatus.comments', 'Comments'),
            insights: t('metaPlatform.scopeStatus.insights', 'Insights'),
            pages: t('metaPlatform.scopeStatus.pages', 'Pages'),
            threads_insights: t('metaPlatform.scopeStatus.threadsInsights', 'Threads Insights'),
            threads_replies: t('metaPlatform.scopeStatus.threadsReplies', 'Threads Replies'),
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
                    {t('metaPlatform.scopeStatus.missing', 'Missing')}: {missing.join(', ')}
                    {(feature === 'threads_insights' || feature === 'threads_replies') && (
                      <span className="block mt-0.5">
                        {t(
                          'metaPlatform.scopeStatus.threadsReconnectHint',
                          'Use Connect Threads on the Instagram integration page.',
                        )}
                      </span>
                    )}
                  </p>
                )}
                {ok && feature !== 'pages' && (
                  <Link
                    to={FEATURE_LINKS[feature]}
                    className="mt-1 inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    {t('metaPlatform.scopeStatus.open', 'Open')}
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
            'metaPlatform.scopeStatus.reconnectHint',
            'Reconnect with Facebook to refresh permission status.',
          )}
        </p>
      )}
    </div>
  );
}
