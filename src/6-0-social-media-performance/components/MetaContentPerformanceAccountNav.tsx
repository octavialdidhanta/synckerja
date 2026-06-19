import { Instagram, Facebook } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/utils';
import type { MetaContentAccount, MetaContentPlatform } from '@/meta-platform/types/metaContentTypes';
import { CollapsibleContentAccountNav } from '@/6-0-social-media-performance/components/CollapsibleContentAccountNav';

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
  const filtered = accounts.filter((a) => a.platform === platform);
  const PlatformIcon = platform === 'instagram' ? Instagram : Facebook;

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
                {acc.avatar_url ? (
                  <img
                    src={acc.avatar_url}
                    alt=""
                    className="h-5 w-5 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <PlatformIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                )}
                <span className="truncate">{label}</span>
              </button>
            );
          })
        )
      }
    />
  );
}
