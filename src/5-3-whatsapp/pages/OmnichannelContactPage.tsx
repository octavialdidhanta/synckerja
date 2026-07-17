import { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { HeaderAndTab } from '@/5-3-dashboard/components/layout/HeaderAndTab';
import { ModuleShellContentGate } from '@/shared/layouts/ModuleShellContentGate';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useToast } from '@/shared/hooks/use-toast';
import { OmnichannelContactFilters } from '@/5-3-whatsapp/components/contacts/OmnichannelContactFilters';
import { OmnichannelContactTable } from '@/5-3-whatsapp/components/contacts/OmnichannelContactTable';
import {
  filterOmnichannelContacts,
  useOmnichannelContactFilterOptions,
  useOmnichannelContacts,
  type OmnichannelContactFilters as ContactFilters,
} from '@/5-3-whatsapp/hooks/useOmnichannelContacts';
import {
  downloadOmnichannelContactsCsv,
  downloadOmnichannelContactsXls,
  mapContactsToExportRows,
} from '@/5-3-whatsapp/utils/exportOmnichannelContacts';

const DEFAULT_FILTERS: ContactFilters = {
  campaignName: '',
  targetMarket: '',
  dateFrom: null,
  dateTo: null,
};

/**
 * `/omnichannel/contact` — Lead Magnet WA contacts with dedupe + export for recipient import.
 */
export function OmnichannelContactPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { organizationId } = useCurrentOrg();
  const { data: allRows = [], isLoading, error } = useOmnichannelContacts(organizationId);
  const [filters, setFilters] = useState<ContactFilters>(DEFAULT_FILTERS);

  const filterOptions = useOmnichannelContactFilterOptions(allRows);

  const filteredRows = useMemo(
    () => filterOmnichannelContacts(allRows, filters),
    [allRows, filters],
  );

  const exportFilenameBase = useMemo(
    () => `omnichannel-contacts-${format(new Date(), 'yyyyMMdd-HHmm')}`,
    [],
  );

  const handleExportCsv = () => {
    if (filteredRows.length === 0) {
      toast({
        variant: 'destructive',
        title: t('omnichannel.contact.exportEmptyTitle'),
        description: t('omnichannel.contact.exportEmptyBody'),
      });
      return;
    }
    downloadOmnichannelContactsCsv(mapContactsToExportRows(filteredRows), exportFilenameBase);
  };

  const handleExportXls = () => {
    if (filteredRows.length === 0) {
      toast({
        variant: 'destructive',
        title: t('omnichannel.contact.exportEmptyTitle'),
        description: t('omnichannel.contact.exportEmptyBody'),
      });
      return;
    }
    downloadOmnichannelContactsXls(mapContactsToExportRows(filteredRows), exportFilenameBase);
  };

  useEffect(() => {
    if (!error) return;
    toast({
      variant: 'destructive',
      title: t('omnichannel.contact.loadErrorTitle'),
      description: error instanceof Error ? error.message : String(error),
    });
  }, [error, toast, t]);

  const pagePending = !organizationId || isLoading;

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface-muted font-sans">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col pl-2 pr-4 pb-2 sm:pl-3">
        <div className="flex h-full min-h-0 min-w-0 w-full flex-col">
          <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-h-full min-w-0 flex-1 flex-col">
              <div className="mb-1 min-w-0 shrink-0">
                <HeaderAndTab />
              </div>
              <ModuleShellContentGate pagePath="/omnichannel/contact">
                <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch">
                  <div className="col-span-12 flex min-h-0 min-w-0 flex-1 flex-col gap-2">
                    <OmnichannelContactFilters
                      filters={filters}
                      onFiltersChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
                      campaignOptions={filterOptions.campaigns}
                      targetMarketOptions={filterOptions.targetMarkets}
                      filteredCount={filteredRows.length}
                      totalCount={allRows.length}
                      onExportCsv={handleExportCsv}
                      onExportXls={handleExportXls}
                      exportDisabled={pagePending || filteredRows.length === 0}
                    />
                    <div className="flex min-h-[560px] min-w-0 flex-1 flex-col rounded-lg border border-border bg-card shadow-sm [@media(max-height:900px)]:min-h-[620px] [@media(max-height:760px)]:min-h-[680px]">
                      <OmnichannelContactTable rows={filteredRows} isLoading={pagePending} />
                    </div>
                  </div>
                </div>
                <div
                  className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
                  aria-hidden
                />
              </ModuleShellContentGate>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
