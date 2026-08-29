import { useState } from 'react';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Button } from '@/shared/components/ui/button';
import { useOrgBootstrapPending } from '@/shared/auth/hooks/useOrgBootstrapPending';
import { useDebouncedReady } from '@/shared/hooks/useDebouncedReady';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { CustomersModuleShell } from '../layout/CustomersModuleShell';
import { CustomersToolbar } from '../components/CustomersToolbar';
import { CustomersTable } from '../components/CustomersTable';
import { CustomersTableFooter } from '../components/CustomersTableFooter';
import { useCustomersList } from '../hooks/useCustomersList';

export default function CustomersPage() {
  const { t } = useAppTranslation();
  const { orgBootstrapPending } = useOrgBootstrapPending();
  const [search, setSearch] = useState('');
  const { rows, allRows, isLoading, isError, error, refetch } = useCustomersList(search);
  const showContent = useDebouncedReady(!(orgBootstrapPending || isLoading), 200);

  return (
    <CustomersModuleShell showContent={showContent}>
      <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
        <div className="col-span-12 flex min-h-[560px] min-w-0 flex-1 basis-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
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
          <CustomersTableFooter totalCustomers={allRows.length} filteredCustomers={rows.length} />
        </div>
      </div>
      <div className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4" aria-hidden />
    </CustomersModuleShell>
  );
}
