import { Instagram, Facebook } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/utils';
import type { MetaContentAccount, MetaContentPlatform } from '@/meta-platform/types/metaContentTypes';
import { CollapsibleContentAccountNav } from '@/6-0-social-media-performance/components/CollapsibleContentAccountNav';

const COLLAPSED_STORAGE_KEY: Record<MetaContentPlatform, string> = {
  instagram: 'synckerja.meta-content-account-nav.instagram.collapsed',
  facebook: 'synckerja.meta-content-account-nav.facebook.collapsed',
};

type MetaContentAccountNavProps = {
  platform: MetaContentPlatform;
  accounts: MetaContentAccount[];
  selectedAccountId: string;
  onSelectAccountId: (id: string) => void;
  settingsActive?: boolean;
  onSettingsSelect?: () => void;
  className?: string;
};

export function MetaContentAccountNav({
  platform,
  accounts,
  selectedAccountId,
  onSelectAccountId,
  settingsActive,
  onSettingsSelect,
  className,
}: MetaContentAccountNavProps) {
  const { t } = useTranslation();
  const filtered = accounts.filter((a) => a.platform === platform);
  const FallbackIcon = platform === 'instagram' ? Instagram : Facebook;

  return (
    <CollapsibleContentAccountNav
      storageKey={COLLAPSED_STORAGE_KEY[platform]}
      sectionLabel={t('digitalMarketing.tiktokContent.accounts', 'Accounts')}
      collapseLabel={t(
        'digitalMarketing.tiktokContent.collapseAccounts',
        'Collapse accounts',
      )}
      expandLabel={t('digitalMarketing.tiktokContent.expandAccounts', 'Expand accounts')}
      settingsLabel={t('digitalMarketing.tiktokContent.settings', 'Settings')}
      settingsActive={settingsActive}
      onSettingsSelect={onSettingsSelect}
      className={className}
      accounts={
        filtered.length === 0 ? (
          <p className="px-2 text-xs text-muted-foreground">
            {t('metaPlatform.noAccounts', 'No connected accounts.')}
          </p>
        ) : (
          filtered.map((acc) => {
            const active = acc.account_id === selectedAccountId;
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
                onClick={() => onSelectAccountId(acc.account_id)}
              >
                {acc.avatar_url ? (
                  <img
                    src={acc.avatar_url}
                    alt=""
                    className="h-4 w-4 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <FallbackIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
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
