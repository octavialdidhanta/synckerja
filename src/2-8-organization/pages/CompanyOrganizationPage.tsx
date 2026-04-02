import React, { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Hand, RotateCcw, Search, ZoomIn, ZoomOut } from 'lucide-react';
import {
  OrganizationalDiagram,
  type OrganizationalDiagramHandle,
} from '@/2-8-organization/components/diagram/OrganizationalDiagram';
import { OrganizationStatistics } from '@/2-8-organization/components/statistics/OrganizationStatistics';
import {
  OrganizationPageSkeleton,
} from '@/2-8-organization/components/OrganizationPageSkeleton';
import { useOrganizationalStructure } from '@/2-8-organization/hooks/useOrganizationalStructure';
import { useOrganizationPagePending } from '@/2-8-organization/hooks/useOrganizationPagePending';
import { useDebouncedReady } from '@/shared/hooks/useDebouncedReady';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { CompanyModuleShell } from '@/2-8-dashboard/layout/CompanyModuleShell';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { cn } from '@/shared/lib/utils';

export const CompanyOrganizationPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [zoomLevel, setZoomLevel] = useState(1);
  const diagramRef = useRef<OrganizationalDiagramHandle>(null);
  const navigate = useNavigate();
  const { t } = useAppTranslation();

  const { statistics } = useOrganizationalStructure();
  const pending = useOrganizationPagePending();
  const showContentReady = useDebouncedReady(!pending, 220);
  const showShellSkeleton = !showContentReady;
  const loadingAria = t('organization.page.loadingAria', 'Loading organizational structure');

  const handleEmployeeClick = (employeeId: string) => {
    navigate(`/my-info/personal?id=${employeeId}`);
  };

  const zoomOut = useCallback(() => {
    setZoomLevel((z) => Math.max(0.5, z - 0.1));
  }, []);

  const zoomIn = useCallback(() => {
    setZoomLevel((z) => Math.min(2, z + 0.1));
  }, []);

  const sidebarTools = (
    <div className="shrink-0 space-y-3 border-b border-border pb-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        {t('organization.diagram.title', 'Organizational structure')}
      </h2>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={t(
            'organization.diagram.searchPlaceholder',
            'Search by name, email, or position…'
          )}
          className="pl-10 text-sm"
          aria-label={t('organization.diagram.searchPlaceholder', 'Search by name, email, or position…')}
        />
      </div>
      <p className="flex items-start gap-2 rounded-md border border-dashed border-muted-foreground/30 bg-muted/40 px-2 py-2 text-xs leading-snug text-muted-foreground">
        <Hand className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>{t('organization.diagram.panHint', 'Drag empty area to pan the chart (hand cursor).')}</span>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => diagramRef.current?.resetView()}
          title={t('organization.diagram.resetView', 'Reset position and zoom')}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={zoomOut}>
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="min-w-[48px] text-center text-sm font-medium tabular-nums text-foreground">
          {Math.round(zoomLevel * 100)}%
        </span>
        <Button type="button" variant="outline" size="sm" onClick={zoomIn}>
          <ZoomIn className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <CompanyModuleShell>
      <div className="relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
        {showShellSkeleton ? (
          <div
            className="absolute inset-0 z-10 flex min-h-0 flex-col overflow-hidden bg-gray-100"
            aria-busy="true"
            aria-label={loadingAria}
          >
            <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <OrganizationPageSkeleton className="min-h-0 flex-1" />
            </div>
          </div>
        ) : null}
        <div
          className={cn(
            'flex min-h-0 min-w-0 flex-1 flex-col',
            showShellSkeleton && 'pointer-events-none invisible'
          )}
        >
          <div
            className={cn(
              'grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-3 rounded-lg border border-border bg-card p-4 shadow-sm lg:gap-4',
              '[grid-template-rows:minmax(0,1fr)] items-stretch',
              '[@media(max-height:900px)]:min-h-[640px] [@media(max-height:900px)]:flex-none',
              '[@media(max-height:760px)]:min-h-[700px]'
            )}
          >
            <div className="col-span-12 flex min-h-0 min-w-0 flex-col overflow-hidden lg:col-span-9">
              <OrganizationalDiagram
                ref={diagramRef}
                onEmployeeClick={handleEmployeeClick}
                searchTerm={searchTerm}
                zoomLevel={zoomLevel}
                onZoomLevelChange={setZoomLevel}
              />
            </div>
            <aside className="col-span-12 flex w-full shrink-0 flex-col gap-3 border-border lg:col-span-3 lg:min-h-0 lg:border-l lg:pl-4">
              {sidebarTools}
              <OrganizationStatistics statistics={statistics} />
            </aside>
          </div>
        </div>
      </div>
    </CompanyModuleShell>
  );
};

export default CompanyOrganizationPage;
