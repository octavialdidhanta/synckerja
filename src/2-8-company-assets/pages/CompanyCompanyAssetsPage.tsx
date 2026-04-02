import React, { useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { CompanyModuleShell } from '@/2-8-dashboard/layout/CompanyModuleShell';
import { AssetsFilters } from '@/2-8-company-assets/components/filters/AssetsFilters';
import { CompanyAssetsMetricsCards } from '@/2-8-company-assets/components/metrics/CompanyAssetsMetricsCards';
import { AssetsTable } from '@/2-8-company-assets/components/table/AssetsTable';
import { AddAssetModal } from '@/2-8-company-assets/components/modals/AddAssetModal';
import { CompanyAssetsOverviewFooter } from '@/2-8-company-assets/components/overview/CompanyAssetsOverviewFooter';
import { CompanyAssetsPageSkeleton } from '@/2-8-dashboard/skeletons/CompanyPageSkeletons';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCentralizedUserData } from '@/shared/auth/contexts/CentralizedUserDataContext';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useDebouncedReady } from '@/shared/hooks/useDebouncedReady';
import { useShowToast } from '@/shared/hooks/useShowToast';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { cn } from '@/shared/lib/utils';

export const CompanyCompanyAssetsPage = () => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Types');
  const [selectedStatus, setSelectedStatus] = useState('All Statuses');
  const [selectedCondition, setSelectedCondition] = useState('All Conditions');
  const [selectedReceiptFilter, setSelectedReceiptFilter] = useState<string>('all');
  const [assets, setAssets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const { t } = useAppTranslation();
  const { loading: userDataLoading } = useCentralizedUserData();
  const { organizationId, loading: orgProfileLoading } = useCurrentOrg();
  const showToast = useShowToast();

  useLayoutEffect(() => {
    if (organizationId) {
      setIsLoading(true);
    }
  }, [organizationId]);

  const fetchAssets = useCallback(async () => {
    if (!organizationId) {
      setAssets([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data: rawData, error } = await supabase
        .from('company_assets')
        .select(`
          *,
          employees!assigned_to_employee_id(full_name, department_id)
        `)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const employeeIds = (rawData || [])
        .map((r: any) => (Array.isArray(r.employees) ? r.employees[0]?.department_id : r.employees?.department_id))
        .filter(Boolean);
      const uniqueDeptIds = [...new Set(employeeIds)] as string[];
      let deptMap: Record<string, string> = {};
      if (uniqueDeptIds.length > 0) {
        const { data: depts } = await supabase.from('departments').select('id, name').in('id', uniqueDeptIds);
        deptMap = (depts || []).reduce((acc, d) => ({ ...acc, [d.id]: d.name }), {});
      }

      const data = (rawData || []).map((row: any) => {
        const emp = row.employees;
        const assigned_employee_name = Array.isArray(emp) ? emp[0]?.full_name : emp?.full_name;
        const assigned_department_id = Array.isArray(emp) ? emp[0]?.department_id : emp?.department_id;
        const assigned_department_name = assigned_department_id ? deptMap[assigned_department_id] ?? null : null;
        const { employees: _emp, ...rest } = row;
        return {
          ...rest,
          requester_name: null,
          department_name: null,
          assigned_employee_name: assigned_employee_name ?? null,
          assigned_department_name: assigned_department_name ?? null,
        };
      });
      setAssets(data);
    } catch (primaryError: any) {
      console.warn('Primary assets fetch failed, trying fallback without employees join:', primaryError?.message);
      try {
        const { data: rawData, error } = await supabase
          .from('company_assets')
          .select('*')
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: false });
        if (error) throw error;

        const assignedIds = [...new Set((rawData || []).map((r: any) => r.assigned_to_employee_id).filter(Boolean))] as string[];
        let empMap: Record<string, { full_name: string; department_id: string | null }> = {};
        let deptMap: Record<string, string> = {};
        if (assignedIds.length > 0) {
          const { data: emps } = await supabase.from('employees').select('id, full_name, department_id').in('id', assignedIds);
          empMap = (emps || []).reduce((acc, e) => ({ ...acc, [e.id]: { full_name: e.full_name, department_id: e.department_id ?? null } }), {});
          const deptIds = [...new Set((emps || []).map((e) => e.department_id).filter(Boolean))] as string[];
          if (deptIds.length > 0) {
            const { data: depts } = await supabase.from('departments').select('id, name').in('id', deptIds);
            deptMap = (depts || []).reduce((acc, d) => ({ ...acc, [d.id]: d.name }), {});
          }
        }

        const data = (rawData || []).map((row: any) => {
          const emp = row.assigned_to_employee_id ? empMap[row.assigned_to_employee_id] : null;
          const assigned_employee_name = emp?.full_name ?? null;
          const assigned_department_name = emp?.department_id ? (deptMap[emp.department_id] ?? null) : null;
          return {
            ...row,
            requester_name: null,
            department_name: null,
            assigned_employee_name: assigned_employee_name ?? null,
            assigned_department_name: assigned_department_name ?? null,
          };
        });
        setAssets(data);
      } catch (fallbackError: any) {
        console.error('Error fetching assets:', fallbackError);
        showToast({
          title: t('common.error', 'Error'),
          description: fallbackError?.message || t('companyAssets.fetchFailed', 'Failed to fetch assets'),
          variant: 'destructive'
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, showToast, t]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const handleAddAsset = useCallback((assetData: any) => {
    console.log('Adding asset:', assetData);
    setIsAddModalOpen(false);
    fetchAssets();
  }, [fetchAssets]);

  const handleRefresh = useCallback(() => {
    fetchAssets();
  }, [fetchAssets]);

  const rawLoading =
    userDataLoading || orgProfileLoading || !organizationId || isLoading;
  const showContentReady = useDebouncedReady(!rawLoading, 220);
  const showShellSkeleton = !showContentReady;
  const loadingAria = t('company.page.loadingAria', 'Loading company');

  const lastUpdated = assets.length > 0 
    ? assets[0].created_at 
    : undefined;

  return (
    <>
      <CompanyModuleShell>
        <div className="relative flex min-h-0 min-w-0 w-full flex-1 flex-col">
          {showShellSkeleton ? (
            <div
              className="absolute inset-0 z-10 flex min-h-0 flex-col overflow-hidden bg-gray-100"
              aria-busy="true"
              aria-label={loadingAria}
            >
              <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-y-auto overflow-x-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <CompanyAssetsPageSkeleton className="min-h-0 flex-1" />
              </div>
            </div>
          ) : null}
          <div
            className={cn(
              'flex min-h-0 min-w-0 w-full flex-1 flex-col',
              showShellSkeleton && 'pointer-events-none invisible'
            )}
          >
            <div className="grid min-h-[calc(100vh-120px)] min-w-0 w-full flex-1 grid-cols-12 gap-2 [grid-template-rows:minmax(0,1fr)] items-stretch [@media(max-height:900px)]:min-h-[640px] [@media(max-height:900px)]:flex-none [@media(max-height:760px)]:min-h-[700px]">
              <div className="col-span-9 flex h-full min-h-0 min-w-0 w-full flex-1 flex-col self-stretch">
                <div className="mb-2 shrink-0">
                  <div className="rounded-md border border-border bg-card p-2">
                    <AssetsFilters
                        selectedCategory={selectedCategory}
                        selectedStatus={selectedStatus}
                        selectedCondition={selectedCondition}
                        selectedReceiptFilter={selectedReceiptFilter}
                        onReceiptFilterChange={setSelectedReceiptFilter}
                        onCategoryChange={setSelectedCategory}
                        onStatusChange={setSelectedStatus}
                        onConditionChange={setSelectedCondition}
                        searchTerm={searchTerm}
                        onSearchChange={setSearchTerm}
                        onRefresh={handleRefresh}
                        onAddAsset={() => setIsAddModalOpen(true)}
                      />
                    </div>
                  </div>

                  <div className="mb-2 shrink-0">
                    <CompanyAssetsMetricsCards assets={assets} />
                  </div>

                  <div className="min-h-0 flex-1">
                    <div className="flex h-full min-h-0 flex-col seamless-scroll rounded-lg border border-border bg-card shadow-sm">
                      <AssetsTable 
                        assets={assets}
                        searchTerm={searchTerm}
                        selectedCategory={selectedCategory}
                        selectedStatus={selectedStatus}
                        selectedCondition={selectedCondition}
                        selectedReceiptFilter={selectedReceiptFilter}
                        isLoading={isLoading}
                        onRefresh={fetchAssets}
                      />
                    </div>
                  </div>
              </div>

              <div className="col-span-3 flex h-full min-h-0 min-w-0 w-full flex-1 flex-col self-stretch">
                <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-border bg-card">
                  <div className="shrink-0 border-b border-border px-4 py-1.5">
                    <div className="flex flex-col">
                      <h3 className="text-sm font-semibold text-foreground">Assets Overview</h3>
                      <p className="mt-1 text-xs text-muted-foreground">Latest asset activities and status</p>
                    </div>
                  </div>

                  <div className="flex min-h-0 flex-1 flex-col">
                    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden seamless-scroll nested-scroll-touch-chain p-4">
                      <div className="grid grid-cols-1 gap-3">
                        <div className="rounded-lg border border-border bg-info-muted p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs font-medium text-info-foreground">Total Assets</p>
                              <p className="text-lg font-bold text-foreground">{assets.length}</p>
                            </div>
                          </div>
                        </div>
                        <div className="rounded-lg border border-border bg-success-muted p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs font-medium text-success-foreground">Available</p>
                              <p className="text-lg font-bold text-foreground">
                                {assets.filter((a: { status: string }) => a.status === 'available').length}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="rounded-lg border border-border bg-accent p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs font-medium text-accent-foreground">In Use</p>
                              <p className="text-lg font-bold text-foreground">
                                {assets.filter((a: { status: string }) => a.status === 'in-use').length}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="rounded-lg border border-border bg-warning-muted p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs font-medium text-warning-foreground">Maintenance</p>
                              <p className="text-lg font-bold text-foreground">
                                {assets.filter((a: { status: string }) => a.status === 'maintenance').length}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <CompanyAssetsOverviewFooter lastUpdated={lastUpdated} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CompanyModuleShell>

      <AddAssetModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={handleAddAsset}
      />
    </>
  );
};

export default CompanyCompanyAssetsPage;
