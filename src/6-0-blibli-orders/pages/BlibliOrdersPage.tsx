import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { Button } from '@/shared/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert';
import { useBlibliSellerSettings } from '@/6-0-ecommerce-chat/hooks/useBlibliSellerSettings';
import { useBlibliOrderPackagesQuery } from '@/blibli-orders/hooks/useBlibliOrderPackagesQuery';
import { useBlibliOrderStatusCountsQuery } from '@/blibli-orders/hooks/useBlibliOrderStatusCountsQuery';
import type { BlibliOrderPackageGroup } from '@/blibli-orders/hooks/useBlibliOrderPackagesQuery';
import type { BlibliOrderStatusTab } from '@/blibli-orders/lib/blibliOrderStatusTabs';
import {
  BLIBLI_ORDERS_DEFAULT_PAGE_SIZE,
  clampBlibliOrderDateRange,
  defaultBlibliOrderDateRange,
} from '@/blibli-orders/lib/clampBlibliOrderDateRange';
import { BLIBLI_ORDERS_SETTINGS_PATH } from '@/blibli-orders/lib/blibliOrdersPaths';
import { BlibliOrdersModuleShell } from '../layout/BlibliOrdersModuleShell';
import { BlibliOrdersStoreSelector } from '../components/BlibliOrdersStoreSelector';
import { BlibliOrdersStatusTabs } from '../components/BlibliOrdersStatusTabs';
import { BlibliOrdersFiltersBar } from '../components/BlibliOrdersFiltersBar';
import { BlibliOrdersList } from '../components/BlibliOrdersList';
import { BlibliOrderDetailDrawer } from '../components/BlibliOrderDetailDrawer';

function toDateInputValue(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fromDateInputValue(value: string, endOfDay: boolean): number {
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return Date.now();
  const dt = new Date(y, m - 1, d, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
  return dt.getTime();
}

export default function BlibliOrdersPage() {
  const { t } = useTranslation();
  const { organizationId } = useCurrentOrg();
  const settings = useBlibliSellerSettings(organizationId);
  const connections = settings.data?.connections ?? [];
  const connected = Boolean(settings.data?.connected);
  const serverConfigured = settings.data?.serverConfigured !== false;

  const defaultConn =
    connections.find((c) => c.is_default)?.id ?? connections[0]?.id ?? null;
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const activeConnectionId = connectionId ?? defaultConn;

  const initialRange = defaultBlibliOrderDateRange();
  const [statusTab, setStatusTab] = useState<BlibliOrderStatusTab>('new');
  const [searchDraft, setSearchDraft] = useState('');
  const [searchIds, setSearchIds] = useState<string[]>([]);
  const [dateStart, setDateStart] = useState(toDateInputValue(initialRange.start));
  const [dateEnd, setDateEnd] = useState(toDateInputValue(initialRange.end));
  const [sortBy, setSortBy] = useState('statusFPUpdatedTimestamp');
  const [sortDirection, setSortDirection] = useState<'ASC' | 'DESC'>('DESC');
  const [page, setPage] = useState(0);
  const [detailPkg, setDetailPkg] = useState<BlibliOrderPackageGroup | null>(null);

  const dateRange = useMemo(
    () =>
      clampBlibliOrderDateRange({
        start: fromDateInputValue(dateStart, false),
        end: fromDateInputValue(dateEnd, true),
      }),
    [dateStart, dateEnd],
  );

  const listEnabled = Boolean(organizationId) && connected && Boolean(activeConnectionId);

  const packagesQuery = useBlibliOrderPackagesQuery({
    organizationId: organizationId ?? '',
    connectionId: activeConnectionId,
    statusTab,
    searchIds,
    dateRange,
    sortBy,
    sortDirection,
    page,
    size: BLIBLI_ORDERS_DEFAULT_PAGE_SIZE,
    enabled: listEnabled,
  });

  const countsQuery = useBlibliOrderStatusCountsQuery({
    organizationId,
    connectionId: activeConnectionId,
    dateRange,
    enabled: listEnabled,
  });

  const onSearchSubmit = () => {
    const parts = searchDraft
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    setSearchIds(parts);
    setPage(0);
  };

  return (
    <BlibliOrdersModuleShell>
      <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
        <div className="col-span-12 flex min-h-[560px] min-w-0 flex-1 flex-col rounded-lg border border-border bg-card p-4 shadow-sm [@media(max-height:900px)]:min-h-[620px] [@media(max-height:760px)]:min-h-[680px]">
          {!serverConfigured && (
            <Alert variant="destructive" className="mb-3">
              <AlertTitle>{t('operations.blibliOrders.serverNotConfiguredTitle')}</AlertTitle>
              <AlertDescription>
                {t('operations.blibliOrders.serverNotConfiguredDesc')}
              </AlertDescription>
            </Alert>
          )}

          {!connected ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
              <p className="text-sm font-medium">{t('operations.blibliOrders.notConnectedTitle')}</p>
              <p className="max-w-md text-xs text-muted-foreground">
                {t('operations.blibliOrders.notConnectedBody')}
              </p>
              <Button asChild size="sm">
                <Link to={BLIBLI_ORDERS_SETTINGS_PATH}>
                  {t('operations.blibliOrders.goToSettings')}
                </Link>
              </Button>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <BlibliOrdersStoreSelector
                  connections={connections}
                  value={activeConnectionId}
                  onChange={(id) => {
                    setConnectionId(id);
                    setPage(0);
                  }}
                />
              </div>

              <BlibliOrdersFiltersBar
                search={searchDraft}
                onSearchChange={setSearchDraft}
                onSearchSubmit={onSearchSubmit}
                dateStart={dateStart}
                dateEnd={dateEnd}
                onDateStartChange={(v) => {
                  setDateStart(v);
                  setPage(0);
                }}
                onDateEndChange={(v) => {
                  setDateEnd(v);
                  setPage(0);
                }}
                sortBy={sortBy}
                sortDirection={sortDirection}
                onSortByChange={(v) => {
                  setSortBy(v);
                  setPage(0);
                }}
                onSortDirectionChange={(v) => {
                  setSortDirection(v);
                  setPage(0);
                }}
              />

              <BlibliOrdersStatusTabs
                value={statusTab}
                onChange={(tab) => {
                  setStatusTab(tab);
                  setPage(0);
                }}
                counts={countsQuery.data}
              />

              <div className="min-h-0 flex-1">
                <BlibliOrdersList
                  packages={packagesQuery.data?.packages ?? []}
                  paging={packagesQuery.data?.paging ?? null}
                  isLoading={packagesQuery.isLoading || packagesQuery.isFetching}
                  isError={packagesQuery.isError}
                  errorMessage={
                    packagesQuery.error instanceof Error
                      ? packagesQuery.error.message
                      : undefined
                  }
                  onOpenDetail={setDetailPkg}
                  onPageChange={setPage}
                />
              </div>
            </div>
          )}
        </div>
      </div>
      <div
        className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
        aria-hidden
      />
      <BlibliOrderDetailDrawer
        pkg={detailPkg}
        open={Boolean(detailPkg)}
        onOpenChange={(open) => {
          if (!open) setDetailPkg(null);
        }}
      />
    </BlibliOrdersModuleShell>
  );
}
