import React, { lazy, Suspense, useState } from 'react';
import { SalesActivitiesFilters } from './SalesActivitiesFilters';
import { SalesActivitiesMetricsCards } from './SalesActivitiesMetricsCards';
import { SalesActivitiesTable } from './SalesActivitiesTable';
import { SalesActivitiesOverview } from './SalesActivitiesOverview';
import { SalesActivitiesSidebarFooter } from './SalesActivitiesSidebarFooter';
import { SalesActivityDialog } from './SalesActivityDialog';
import type { TaskFormData } from '@/8-2-DailyTask/section/CreateTaskDialog';

const PaymentUpdateModal = lazy(() =>
  import('@/5-2-jadwal-kunjungan/components/PaymentUpdateModal').then((m) => ({
    default: m.PaymentUpdateModal,
  })),
);
const CreateTaskDialog = lazy(() =>
  import('@/8-2-DailyTask/section/CreateTaskDialog').then((m) => ({
    default: m.CreateTaskDialog,
  })),
);
import { SopSelectionPopup } from './SopSelectionPopup';
import { useSalesActivities, type SalesActivity } from '@/shared/hooks/organized/sales';
import { useDailyTask } from '@/8-2-DailyTask/context/DailyTaskContext';
import { Button } from '@/shared/components/ui/button';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { useToast } from '@/shared/components/ui/use-toast';
import { devLog } from '@/shared/lib/logger';
import {
  DEFAULT_SALES_ACTIVITIES_FILTERS,
  filterSalesActivities,
  type SalesActivitiesFiltersState,
} from '../utils/salesActivitiesFilterUtils';
import {
  SALES_OPS_MAIN_COLUMN,
  SALES_OPS_MAIN_GRID,
  SALES_OPS_SIDEBAR_COLUMN,
  SALES_OPS_TABLE_SECTION,
} from '@/5-2-activities/layout/salesOperationsLayout';

export const SalesActivitiesPageContent = () => {
  const { activities, refetch, error, isError, deleteSalesActivity } = useSalesActivities();
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [editingActivity, setEditingActivity] = useState<SalesActivity | null>(null);
  const [activityDialogReadOnly, setActivityDialogReadOnly] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedActivityForPayment, setSelectedActivityForPayment] = useState<SalesActivity | null>(null);
  const [paymentModalViewOnly, setPaymentModalViewOnly] = useState(false);
  const [showCreateTaskDialog, setShowCreateTaskDialog] = useState(false);
  const [createTaskPrefill, setCreateTaskPrefill] = useState<{
    title: string;
    description: string;
    service_id: string;
    sub_service_id: string | null;
  } | null>(null);
  const [createTaskFromPayment, setCreateTaskFromPayment] = useState(false);
  const [sopPopupOpen, setSopPopupOpen] = useState(false);
  const [pendingTaskFormData, setPendingTaskFormData] = useState<TaskFormData | null>(null);
  const { refetchTasks } = useDailyTask();
  const [filters, setFilters] = useState<SalesActivitiesFiltersState>({
    ...DEFAULT_SALES_ACTIVITIES_FILTERS,
  });

  const handleEdit = (activity: SalesActivity) => {
    setEditingActivity(activity);
    setActivityDialogReadOnly(false);
    setShowDialog(true);
  };

  const handleViewDetails = (activity: SalesActivity) => {
    setEditingActivity(activity);
    setActivityDialogReadOnly(true);
    setShowDialog(true);
  };

  const handleDialogSuccess = () => {
    // Force immediate refresh
    refetch();
    
    // Close dialog and clear editing activity
    setShowDialog(false);
    setEditingActivity(null);
    setActivityDialogReadOnly(false);
  };

  const handleCloseDialog = (open: boolean) => {
    setShowDialog(open);
    if (!open) {
      setEditingActivity(null);
      setActivityDialogReadOnly(false);
    }
  };

  const handleUpdatePayment = (activity: SalesActivity) => {
    setSelectedActivityForPayment(activity);
    setPaymentModalViewOnly(false);
    setShowPaymentModal(true);
  };

  const handleCheckHistory = (activity: SalesActivity) => {
    setSelectedActivityForPayment(activity);
    setPaymentModalViewOnly(true);
    setShowPaymentModal(true);
  };

  const handleClosePaymentModal = () => {
    setShowPaymentModal(false);
    setSelectedActivityForPayment(null);
    setPaymentModalViewOnly(false);
  };

  const handleFirstPaymentSuccess = (payload: {
    title: string;
    description: string;
    service_id: string;
    sub_service_id: string | null;
  }) => {
    setCreateTaskPrefill(payload);
    setCreateTaskFromPayment(true);
    setShowCreateTaskDialog(true);
  };

  const handleSubmitWithSop = (formData: TaskFormData) => {
    setPendingTaskFormData(formData);
    setSopPopupOpen(true);
  };

  const handleSopSuccess = () => {
    setShowCreateTaskDialog(false);
    setCreateTaskPrefill(null);
    setCreateTaskFromPayment(false);
    setPendingTaskFormData(null);
    setSopPopupOpen(false);
    refetchTasks?.();
  };

  const handleSopCancel = () => {
    setSopPopupOpen(false);
    setPendingTaskFormData(null);
  };

  const handleCreateTaskDialogOpenChange = (open: boolean) => {
    if (!open) {
      setShowCreateTaskDialog(false);
      setCreateTaskPrefill(null);
      setCreateTaskFromPayment(false);
    }
  };

  const handleDelete = async (activity: SalesActivity) => {
    if (!confirm(`Are you sure you want to delete this sales activity for "${activity.client_name}"?`)) {
      return;
    }

    try {
      await deleteSalesActivity(activity.id);
      toast({
        title: "Success",
        description: "Sales activity deleted successfully",
      });
    } catch (error: any) {
      devLog.error('Error deleting sales activity:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete sales activity",
        variant: "destructive",
      });
    }
  };

  const filteredActivities = React.useMemo(
    () => filterSalesActivities(activities, filters),
    [activities, filters],
  );

  // Calculate unique activity types for footer
  const uniqueTypes = [...new Set(filteredActivities.map(a => a.activity_type).filter(Boolean))];

  return (
    <>
      {/* Edit Dialog */}
      <SalesActivityDialog
        open={showDialog}
        onOpenChange={handleCloseDialog}
        onSuccess={handleDialogSuccess}
        activity={editingActivity}
        readOnly={activityDialogReadOnly}
      />

      {showPaymentModal && (
        <Suspense fallback={null}>
          <PaymentUpdateModal
            open={showPaymentModal}
            onClose={handleClosePaymentModal}
            salesActivityId={selectedActivityForPayment?.id || ''}
            clientName={selectedActivityForPayment?.client_name || ''}
            viewOnly={paymentModalViewOnly}
            onFirstPaymentSuccess={handleFirstPaymentSuccess}
          />
        </Suspense>
      )}

      {showCreateTaskDialog && (
        <Suspense fallback={null}>
          <CreateTaskDialog
            open={showCreateTaskDialog}
            onOpenChange={handleCreateTaskDialogOpenChange}
            defaultTitle={createTaskPrefill?.title ?? ''}
            defaultDescription={createTaskPrefill?.description ?? ''}
            dismissible={!createTaskFromPayment}
            onSubmitWithSop={createTaskFromPayment ? handleSubmitWithSop : undefined}
          />
        </Suspense>
      )}

      <SopSelectionPopup
        open={sopPopupOpen}
        onClose={() => setSopPopupOpen(false)}
        formData={pendingTaskFormData}
        serviceId={createTaskPrefill?.service_id ?? null}
        subServiceId={createTaskPrefill?.sub_service_id ?? null}
        onSuccess={handleSopSuccess}
        onCancel={handleSopCancel}
      />

      <div className={SALES_OPS_MAIN_GRID}>
        <div className={`${SALES_OPS_MAIN_COLUMN} flex flex-col gap-2`}>
          <div className="rounded-md border bg-white p-2">
            <SalesActivitiesFilters
              filters={filters}
              onFiltersChange={setFilters}
              onCreateSuccess={() => refetch()}
            />
          </div>

          <SalesActivitiesMetricsCards activities={filteredActivities} />

          {isError && (
            <Alert variant="destructive">
              <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {error instanceof Error ? error.message : "Failed to load sales activities."}
                </span>
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <div className={SALES_OPS_TABLE_SECTION}>
            <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              <SalesActivitiesTable
                activities={filteredActivities}
                totalUnfilteredCount={activities.length}
                onUpdate={refetch}
                onEdit={handleEdit}
                onViewDetails={handleViewDetails}
                onDelete={handleDelete}
                onUpdatePayment={handleUpdatePayment}
                onCheckHistory={handleCheckHistory}
                selectedStatus={filters.status}
              />
            </div>
          </div>
        </div>

        <div className={SALES_OPS_SIDEBAR_COLUMN}>
          <div className="flex h-full max-h-full min-h-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="flex-shrink-0 border-b px-4 py-1.5">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-gray-900">Sales Activities Overview</h3>
                <p className="mt-1 text-xs text-gray-500">Summary of sales activities</p>
              </div>
            </div>

            <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain min-h-0 flex-1 overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden p-4">
              <SalesActivitiesOverview activities={filteredActivities} />
            </div>

            <SalesActivitiesSidebarFooter
              totalTypes={uniqueTypes.length}
              totalActivities={filteredActivities.length}
            />
          </div>
        </div>
      </div>
    </>
  );
};
