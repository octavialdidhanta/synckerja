import { useState } from 'react';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Button } from '@/shared/components/ui/button';
import { useOrgBootstrapPending } from '@/shared/auth/hooks/useOrgBootstrapPending';
import { useDebouncedReady } from '@/shared/hooks/useDebouncedReady';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { CustomersModuleShell } from '../layout/CustomersModuleShell';
import { CustomersWorkspace } from '../layout/CustomersWorkspace';
import { CustomersToolbar } from '../components/CustomersToolbar';
import { CustomersTable } from '../components/CustomersTable';
import { useCustomersList } from '../hooks/useCustomersList';

export default function CustomersPage() {
  const { t } = useAppTranslation();
  const { orgBootstrapPending } = useOrgBootstrapPending();
  const [search, setSearch] = useState('');
  const { rows, isLoading, isError, error, refetch } = useCustomersList(search);
  const showContent = useDebouncedReady(!(orgBootstrapPending || isLoading), 200);

  return (
    <CustomersModuleShell showContent={showContent}>
      <CustomersWorkspace count={rows.length}>
          <div className="flex-shrink-0 border-b px-4 py-3">
            <CustomersToolbar search={search} onSearchChange={setSearch} />
          </div>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col p-4">
            {isError ? (
              <Alert variant="destructive" className="mb-3">
                <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {error instanceof Error
                      ? error.message
                      : t('customers.loadError', 'Failed to load customers.')}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => void refetch()}>
                    {t('common.retry', 'Retry')}
                  </Button>
                </AlertDescription>
              </Alert>
            ) : null}
            <CustomersTable rows={rows} />
          </div>
      </CustomersWorkspace>
    </CustomersModuleShell>
  );
}
