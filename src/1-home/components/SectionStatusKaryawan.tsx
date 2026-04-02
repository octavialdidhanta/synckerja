import React, { useState } from 'react';
import { Clock, MapPin, Edit3, Trash2, MoreHorizontal } from 'lucide-react';
import { UnifiedAvatar } from '@/shared/components/UnifiedAvatar';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/shared/components/ui/alert-dialog';
import { ModalStatusKaryawan } from './ModalStatusKaryawan';
import { useEmployeeStatus, EmployeeStatus } from './useEmployeeStatus';
import { useCurrentEmployee } from '@/shared/hooks/useCurrentEmployee';
import { formatDistanceToNow } from "date-fns";
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { applyVariables } from '@/shared/i18n/translations';
import { useToast } from '@/shared/components/ui/use-toast';
import { useReportHomeSectionStatus } from '@/1-home/context/HomePageLoadContext';

interface SectionStatusKaryawanProps {
  statusCreatedTrigger?: number;
}

export const SectionStatusKaryawan = ({ statusCreatedTrigger }: SectionStatusKaryawanProps) => {
  const { t, dateFnsLocale } = useAppTranslation();
  const { toast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [statusCreatedCount, setStatusCreatedCount] = useState(0);
  const [editingStatus, setEditingStatus] = useState<EmployeeStatus | null>(null);
  const [deleteStatusId, setDeleteStatusId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const { statuses, loading, error: statusLoadError, refetch, deleteStatus, updateStatus } = useEmployeeStatus();
  const { data: currentEmployee } = useCurrentEmployee();

  useReportHomeSectionStatus('status', loading, statusLoadError);

  React.useEffect(() => {
    if (statusCreatedTrigger && statusCreatedTrigger > 0) {
      refetch();
    }
  }, [statusCreatedTrigger, refetch]);

  const handleCreateStatus = () => {
    setIsModalOpen(true);
  };

  const handleStatusCreated = () => {
    setStatusCreatedCount(prev => prev + 1);
    refetch();
  };

  const handleEditStatus = (status: EmployeeStatus) => {
    setEditingStatus(status);
    setIsModalOpen(true);
  };

  const handleDeleteStatus = async (statusId: string) => {
    setIsDeleting(true);
    try {
      const success = await deleteStatus(statusId);
      if (success) {
        setDeleteStatusId(null);
        refetch();
      }
    } catch {
      refetch();
      toast({
        title: t('common.error', 'Error'),
        description: t('status.failedToDelete', 'Failed to delete status'),
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingStatus(null);
  };

  const handleStatusUpdated = () => {
    setEditingStatus(null);
    refetch();
  };

  // Check if current user can edit/delete a status
  const canEditStatus = (status: EmployeeStatus) => {
    // Only allow editing if the current user is the owner of the status
    return currentEmployee && status.employee_id === (currentEmployee as any).id;
  };

  // Helper function to format time ago
  const getTimeAgo = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), {
        addSuffix: true,
        locale: dateFnsLocale,
      });
    } catch (error) {
      return t('status.justNow', 'Just now');
    }
  };

  // Helper function to get location display name
  const getLocationDisplayName = (location: string) => {
    const locationMap: { [key: string]: string } = {
      'kantor-pusat': 'Kantor Pusat Jakarta',
      'meeting-a': 'Ruang Meeting A',
      'meeting-b': 'Ruang Meeting B',
      'pantry': 'Pantry',
      'dev-room': 'Dev Room',
      'design-studio': 'Design Studio',
      'remote': 'Remote/WFH'
    };
    return locationMap[location] || location;
  };

  // Helper function to get status color
  const getStatusColor = (statusType: string) => {
    const colorMap: { [key: string]: string } = {
      work: 'bg-info-muted text-info-foreground',
      meeting: 'bg-accent text-accent-foreground',
      break: 'bg-muted text-muted-foreground',
      lunch: 'bg-muted text-muted-foreground',
      training: 'bg-success-muted text-success-foreground',
      other: 'bg-neutral-status-muted text-neutral-status',
    };
    return colorMap[statusType] || 'bg-muted text-muted-foreground';
  };

  if (loading) {
    return null;
  }

  return (
    <div className="rounded-md border border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border p-4">
        <div className="flex items-center space-x-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-accent text-primary">
            <span className="text-sm">👤</span>
          </div>
          <h3 className="text-lg font-semibold leading-snug text-foreground">{t('status.title', 'Employee Status')}</h3>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-xs leading-relaxed text-muted-foreground">
            {applyVariables(t('status.latestUpdates', '{{count}} Latest Updates'), { count: String(statuses.length) })}
          </span>
          <Button
            onClick={handleCreateStatus}
            className="rounded-md px-4 py-2 text-xs font-medium leading-normal"
          >
            + {t('status.createStatus', 'Create Status')}
          </Button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="p-4">
        {statusLoadError ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center text-sm text-destructive">
              {statusLoadError.message ||
                t('home.employeeStatus.loadError', 'Could not load status updates.')}
            </div>
          </div>
        ) : statuses.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">{t('status.noUpdates', 'No status updates yet')}</div>
          </div>
        ) : (
          /* Horizontal scroll container */
          <div className="overflow-x-hidden">
            <div className="flex space-x-4 pb-2" style={{ width: 'max-content' }}>
              {statuses.map((status) => (
                <div key={status.id} className="relative w-80 flex-shrink-0 rounded-md border border-border bg-muted/40 p-4">
                  {/* Action Menu */}
                  {canEditStatus(status) && (
                    <div className="absolute top-3 right-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-32">
                          <DropdownMenuItem
                            onClick={() => handleEditStatus(status)}
                            className="cursor-pointer"
                          >
                            <Edit3 className="h-3 w-3 mr-2" />
                            {t('common.edit', 'Edit')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeleteStatusId(status.id)}
                            className="cursor-pointer text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-3 w-3 mr-2" />
                            {t('status.delete', 'Delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}

                  <div className="flex items-center space-x-3 mb-4">
                    <UnifiedAvatar 
                      photoUrl={status.employees?.profile_photo_url} 
                      name={status.employees?.full_name || t('common.unknown', 'Unknown')} 
                      size="md" 
                    />
                    <div>
                      <h4 className="text-sm font-medium leading-normal text-foreground">
                        {status.employees?.full_name || t('common.unknown', 'Unknown')}
                      </h4>
                      <p className="text-xs leading-normal text-muted-foreground">
                        {status.employees?.departments?.name || t('status.unknownDepartment', 'Unknown Department')}
                      </p>
                    </div>
                  </div>
                  
                  <p className="mb-4 line-clamp-3 text-sm leading-relaxed text-foreground/90">{status.status_text}</p>
                  
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center space-x-1">
                      <Clock className="w-3 h-3" />
                      <span className="leading-normal">{getTimeAgo(status.created_at)}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <MapPin className="w-3 h-3" />
                      <span className="leading-normal">{getLocationDisplayName(status.location)}</span>
                    </div>
                  </div>
                  
                  {/* Status type badge */}
                  <div className="mt-2">
                    <Badge 
                      variant="secondary" 
                      className={`text-xs font-medium px-2 py-1 rounded-full leading-tight ${getStatusColor(status.status_type)}`}
                    >
                      {status.status_type}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Status Modal */}
      <ModalStatusKaryawan
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onStatusCreated={handleStatusCreated}
        onStatusUpdated={handleStatusUpdated}
        editingStatus={editingStatus}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteStatusId} onOpenChange={() => setDeleteStatusId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('status.deleteTitle', 'Delete Status')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('status.deleteDescription', 'Are you sure you want to delete this status? This action cannot be undone.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t('common.cancel', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteStatusId && handleDeleteStatus(deleteStatusId)}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? t('status.deleting', 'Deleting...') : t('status.delete', 'Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};


