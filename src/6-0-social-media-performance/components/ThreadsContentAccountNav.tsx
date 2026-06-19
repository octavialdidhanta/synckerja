import { ThreadsTabIcon } from '@/6-0-social-media-performance/components/ThreadsTabIcon';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/utils';
import type { ThreadsContentAccountRow } from '@/threads-content/hooks/useThreadsContentSettings';
import { CollapsibleContentAccountNav } from '@/6-0-social-media-performance/components/CollapsibleContentAccountNav';
import { CONNECT_INSTAGRAM_PATH } from '@/threads-content/settings/threadsContentSettingsPaths';

const COLLAPSED_STORAGE_KEY = 'synckerja.threads-content-account-nav.collapsed';

type ThreadsContentAccountNavProps = {
  accounts: ThreadsContentAccountRow[];
  accountId: string;
  onAccountIdChange: (accountId: string) => void;
  className?: string;
};

export function ThreadsContentAccountNav({
  accounts,
  accountId,
  onAccountIdChange,
  className,
}: ThreadsContentAccountNavProps) {
  const { t } = useTranslation();

  return (
    <CollapsibleContentAccountNav
      storageKey={COLLAPSED_STORAGE_KEY}
      sectionLabel={t('digitalMarketing.threadsContent.accounts', 'Threads accounts')}
      collapseLabel={t('digitalMarketing.threadsContent.collapseAccounts', 'Collapse accounts')}
      expandLabel={t('digitalMarketing.threadsContent.expandAccounts', 'Expand accounts')}
      settingsLabel={t('digitalMarketing.threadsContent.connectSettings', 'Connect')}
      onSettingsSelect={() => {
        window.location.href = CONNECT_INSTAGRAM_PATH;
      }}
      className={className}
      accounts={accounts.map((acc) => {
        const active = acc.account_id === accountId;
        const label = acc.account_label || acc.account_id;
        return (
          <button
            key={acc.account_id}
            type="button"
            title={label}
            aria-label={label}
            aria-current={active ? 'true' : undefined}
            onClick={() => onAccountIdChange(acc.account_id)}
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors',
              active ? 'bg-primary/10 text-primary' : 'text-gray-700 hover:bg-gray-50',
            )}
          >
            {acc.avatar_url ? (
              <img src={acc.avatar_url} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100">
                <ThreadsTabIcon className="h-4 w-4 text-gray-600" />
              </span>
            )}
            <span className="min-w-0 truncate font-medium">{label}</span>
          </button>
        );
      })}
    />
  );
}
