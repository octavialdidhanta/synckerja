import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/utils';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import type { MetaContentAccount, MetaContentPlatform } from '@/meta-platform/types/metaContentTypes';
import { CollapsibleContentAccountNav } from '@/6-0-social-media-performance/components/CollapsibleContentAccountNav';
import { MetaContentAccountAvatar } from '@/6-0-social-media-performance/components/MetaContentAccountAvatar';

function collapsedStorageKey(platform: MetaContentPlatform): string {
  return `synckerja.meta-content-account-nav.${platform}.collapsed`;
}

type MetaContentPerformanceAccountNavProps = {
  platform: MetaContentPlatform;
  accounts: MetaContentAccount[];
  accountId: string;
  onAccountIdChange: (id: string) => void;
  settingsActive?: boolean;
  onSettingsSelect?: () => void;
  className?: string;
};

export function MetaContentPerformanceAccountNav({
  platform,
  accounts,
  accountId,
  onAccountIdChange,
  settingsActive,
  onSettingsSelect,
  className,
}: MetaContentPerformanceAccountNavProps) {
  const { t } = useTranslation();
  const { organizationId } = useCurrentOrg();
  const filtered = accounts.filter((a) => a.platform === platform);

  return (
    <CollapsibleContentAccountNav
      storageKey={collapsedStorageKey(platform)}
      sectionLabel={t('digitalMarketing.metaContent.accounts', 'Accounts')}
      collapseLabel={t('digitalMarketing.metaContent.collapseAccounts', 'Collapse accounts')}
      expandLabel={t('digitalMarketing.metaContent.expandAccounts', 'Expand accounts')}
      settingsLabel={t('digitalMarketing.metaContent.settings', 'Settings')}
      settingsActive={settingsActive}
      onSettingsSelect={onSettingsSelect}
      className={className}
      accounts={
        filtered.length === 0 ? (
          <p className="px-2 py-1 text-xs text-muted-foreground">
            {t('metaPlatform.noAccounts', 'No connected accounts.')}
          </p>
        ) : (
          filtered.map((acc) => {
            const active = acc.account_id === accountId;
            const label = acc.account_label || acc.account_id;
            return (
              <button
                key={acc.account_id}
                type="button"
                title={label}
                aria-label={label}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                  active
                    ? 'bg-gray-200/80 font-medium text-gray-900'
                    : 'text-gray-700 hover:bg-gray-100',
                )}
                onClick={() => onAccountIdChange(acc.account_id)}
              >
                <MetaContentAccountAvatar
                  organizationId={organizationId}
                  platform={platform}
                  accountId={acc.account_id}
                  accountLabel={label}
                />
                <span className="truncate">{label}</span>
              </button>
            );
          })
        )
      }
    />
  );
}
