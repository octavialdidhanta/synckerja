import { Link } from 'react-router-dom';
import { CheckCircle2, AlertCircle, ExternalLink, Clock } from 'lucide-react';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import {
  META_SCOPE_FEATURE_MAP,
  isPendingAppReviewScope,
  missingScopesForFeature,
} from '@/meta-platform/constants/metaOAuthScopes';
import { cn } from '@/shared/lib/utils';

type ScopeStatusAccount = {
  granted_scopes?: string[] | null;
};

type MetaScopeFeature = keyof typeof META_SCOPE_FEATURE_MAP;

type FeatureStatus = 'ok' | 'pending_review' | 'reconnect' | 'inactive';

type MetaScopeStatusCardsProps = {
  accounts: ScopeStatusAccount[];
  features?: MetaScopeFeature[];
  compact?: boolean;
  hideMissingDetails?: boolean;
};

const THREADS_FEATURES = new Set<MetaScopeFeature>(['threads_insights', 'threads_replies']);

function parseGrantedScopes(account: ScopeStatusAccount): string[] {
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

function resolveFeatureStatus(granted: string[], feature: MetaScopeFeature): FeatureStatus {
  const missing = missingScopesForFeature(granted, feature);
  if (missing.length === 0) return 'ok';
  if (THREADS_FEATURES.has(feature)) return 'inactive';
  if (missing.every((s) => isPendingAppReviewScope(s))) return 'pending_review';
  return 'reconnect';
}

const FEATURE_LINKS: Record<keyof typeof META_SCOPE_FEATURE_MAP, string> = {
  instagram_dm: '/omnichannel/livechat',
  messenger_dm: '/omnichannel/livechat',
  dm: '/omnichannel/livechat',
  comments: '/digital-marketing/social-media-performance/manage-comments/instagram',
  insights: '/digital-marketing/social-media-performance/instagram',
  publish: '/digital-marketing/social-media-performance/instagram/settings',
  facebook_publish: '/digital-marketing/social-media-performance/facebook/settings',
  pages: '/omnichannel/integrations/instagram',
  threads_insights: '/digital-marketing/social-media-performance/threads',
  threads_replies: '/digital-marketing/social-media-performance/manage-comments/threads',
};

const STATUS_STYLES: Record<FeatureStatus, string> = {
  ok: 'border-emerald-200 bg-emerald-50/60',
  pending_review: 'border-amber-200 bg-amber-50/60',
  reconnect: 'border-amber-200 bg-amber-50/60',
  inactive: 'border-slate-200 bg-slate-50/80',
};

export function MetaScopeStatusCards({
  accounts,
  features: featuresFilter,
  compact,
  hideMissingDetails,
}: MetaScopeStatusCardsProps) {
  const { t } = useAppTranslation();
  if (accounts.length === 0) return null;

  const primary = accounts[0];
  const granted = parseGrantedScopes(primary);
  const features =
    featuresFilter ?? (Object.keys(META_SCOPE_FEATURE_MAP) as MetaScopeFeature[]);

  return (
    <div className={cn('space-y-2', !compact && 'border-t border-slate-200 pt-4')}>
      {!compact && (
        <p className="text-xs font-medium text-slate-700">
          {t('metaPlatform.scopeStatus.title', 'Meta permissions status')}
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        {features.map((feature) => {
          const status = resolveFeatureStatus(granted, feature);
          const missing = missingScopesForFeature(granted, feature);
          const labels: Record<typeof feature, string> = {
            instagram_dm: t('metaPlatform.scopeStatus.instagramDm', 'Instagram DM'),
            messenger_dm: t('metaPlatform.scopeStatus.messengerDm', 'Messenger Live Chat'),
            dm: t('metaPlatform.scopeStatus.dm', 'DM Live Chat'),
            comments: t('metaPlatform.scopeStatus.comments', 'Comments'),
            insights: t('metaPlatform.scopeStatus.insights', 'Insights'),
            publish: t('metaPlatform.scopeStatus.publish', 'Reels Publishing'),
            facebook_publish: t('metaPlatform.scopeStatus.facebookPublish', 'Facebook Reels Publishing'),
            pages: t('metaPlatform.scopeStatus.pages', 'Pages'),
            threads_insights: t('metaPlatform.scopeStatus.threadsInsights', 'Threads Insights'),
            threads_replies: t('metaPlatform.scopeStatus.threadsReplies', 'Threads Replies'),
          };

          const statusIcon =
            status === 'ok' ? (
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
            ) : status === 'pending_review' ? (
              <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
            ) : status === 'inactive' ? (
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
            ) : (
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
            );

          const statusMessage =
            status === 'pending_review'
              ? t(
                  'metaPlatform.scopeStatus.pendingAppReview',
                  'Waiting for Meta App Review approval for this permission.',
                )
              : status === 'reconnect'
                ? hideMissingDetails
                  ? t('metaPlatform.scopeStatus.reconnectRequired', 'Reconnect to grant this permission.')
                  : `${t('metaPlatform.scopeStatus.missing', 'Missing')}: ${missing.join(', ')}`
                : status === 'inactive'
                  ? feature === 'threads_insights' || feature === 'threads_replies'
                    ? t(
                        'metaPlatform.scopeStatus.threadsReconnectHint',
                        'Use Connect Threads on the Threads integration tab.',
                      )
                    : t('metaPlatform.scopeStatus.inactive', 'Not configured.')
                  : null;

          return (
            <div
              key={feature}
              className={cn(
                'flex items-start gap-2 rounded-lg border px-3 py-2 text-xs',
                STATUS_STYLES[status],
              )}
            >
              {statusIcon}
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-800">{labels[feature]}</p>
                {statusMessage && (
                  <p className="mt-0.5 text-slate-600">{statusMessage}</p>
                )}
                {status === 'ok' && feature !== 'pages' && (
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
