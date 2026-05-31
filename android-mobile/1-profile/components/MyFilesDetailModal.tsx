import { useCallback, useState } from 'react';
import { FolderOpen, Loader2, Plus } from 'lucide-react';
import { Dialog, DialogContent } from '@/shared/components/ui/dialog';
import { Card } from '@/mobile-app/components/ui/card';
import { Button } from '@/mobile-app/components/ui/button';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import { useToast } from '@/shared/hooks/use-toast';
import {
  ProfileDetailModalHeader,
  profileFullscreenDialogContentClass,
  profileFullscreenScrollBodyClass,
} from '@/mobile/1-profile/components/ProfileInfoModalParts';
import { useProfileMyFiles } from '@/mobile/1-profile/hooks/useProfileMyFiles';
import { MyFilesTable } from '@/mobile/1-profile/components/MyFilesTable';
import { MyFilePreviewDetailModal } from '@/mobile/1-profile/components/MyFilePreviewDetailModal';
import { MyFileEditDetailModal } from '@/mobile/1-profile/components/MyFileEditDetailModal';
import { FileDeleteDialog } from '@/2-8-files/components/modals/files/FileDeleteDialog';
import { FileUploadModal } from '@/2-8-files/components/modals/files/FileUploadModal';
import { MobileFormModalFooter } from '@/mobile-app/components/MobileFormModalFooter';
import type { CompanyFile } from '@/2-8-dashboard/utils/fileTypes';

interface MyFilesDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string | null;
  userId: string | null;
  employeeId: string | null;
}

export const MyFilesDetailModal = ({
  open,
  onOpenChange,
  organizationId,
  userId,
  employeeId,
}: MyFilesDetailModalProps) => {
  const { t } = useAppTranslation();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const enabled = open && Boolean(organizationId && userId);

  const {
    files,
    loading,
    isDeleting,
    isUpdating,
    refetch,
    deleteFile,
    updateFile,
    downloadFile,
  } = useProfileMyFiles({
    organizationId,
    userId,
    employeeId,
    enabled,
  });

  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<CompanyFile | null>(null);
  const [editFile, setEditFile] = useState<CompanyFile | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CompanyFile | null>(null);

  const handleClose = () => onOpenChange(false);

  const handleDownload = useCallback(
    async (file: CompanyFile) => {
      try {
        await downloadFile(file);
        toast({
          title: t('profile.myFiles.downloadSuccess', 'Success'),
          description: t('profile.myFiles.downloadSuccessDesc', 'File downloaded successfully'),
        });
      } catch {
        toast({
          title: t('profile.myFiles.downloadError', 'Error'),
          description: t('profile.myFiles.downloadErrorDesc', 'Failed to download file'),
          variant: 'destructive',
        });
      }
    },
    [downloadFile, t, toast],
  );

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteFile(deleteTarget.id);
      setDeleteTarget(null);
      toast({
        title: t('profile.myFiles.deleteSuccess', 'Success'),
        description: t('profile.myFiles.deleteSuccessDesc', 'File deleted successfully'),
      });
    } catch {
      toast({
        title: t('profile.myFiles.deleteError', 'Error'),
        description: t('profile.myFiles.deleteErrorDesc', 'Failed to delete file'),
        variant: 'destructive',
      });
    }
  };

  const handleUpdateFile = async (id: string, metadata: Record<string, unknown>) => {
    await updateFile(id, metadata);
    toast({
      title: t('profile.myFiles.updateSuccess', 'Success'),
      description: t('profile.myFiles.updateSuccessDesc', 'File updated successfully'),
    });
  };

  const renderBody = () => {
    if (!organizationId || !userId) {
      return (
        <Card className="border border-border bg-gradient-card">
          <div className="p-6 text-center">
            <p className="text-sm text-muted-foreground">
              {!organizationId
                ? t('profile.myFiles.noOrg', 'Organization is not available')
                : t('profile.myFiles.noUser', 'User session is not available')}
            </p>
          </div>
        </Card>
      );
    }

    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden />
        </div>
      );
    }

    if (files.length === 0) {
      return (
        <Card className="border border-border bg-gradient-card">
          <div className="p-6 text-center">
            <p className="text-sm text-muted-foreground">
              {t('profile.myFiles.empty', 'No private files yet')}
            </p>
          </div>
        </Card>
      );
    }

    return (
      <MyFilesTable
        files={files}
        onViewDetails={setPreviewFile}
        onEditFile={setEditFile}
        onDeleteFile={setDeleteTarget}
      />
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={profileFullscreenDialogContentClass(isMobile)}
          fullscreenAnimation={isMobile}
          hideCloseButton={isMobile}
        >
          <ProfileDetailModalHeader
            isMobile={isMobile}
            title={t('profile.myFiles.title', 'My Files')}
            icon={FolderOpen}
            closeLabel={t('layout.sheetClose', 'Close')}
            onClose={handleClose}
          />

          <div className={isMobile ? 'flex min-h-0 flex-1 flex-col' : undefined}>
            <div className={profileFullscreenScrollBodyClass()}>
              <div className="mx-auto w-full max-w-full space-y-3">
                {!isMobile && organizationId && userId && (
                  <div className="flex justify-end">
                    <Button type="button" size="sm" onClick={() => setUploadOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      {t('profile.myFiles.uploadButton', 'Upload File')}
                    </Button>
                  </div>
                )}
                {renderBody()}
              </div>
            </div>

            {isMobile && organizationId && userId && (
              <MobileFormModalFooter>
                <Button
                  type="button"
                  size="sm"
                  className="min-w-[120px]"
                  onClick={() => setUploadOpen(true)}
                  disabled={loading}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {t('profile.myFiles.uploadButton', 'Upload File')}
                </Button>
              </MobileFormModalFooter>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <FileUploadModal
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        forcedVisibility="privat"
        defaultEmployeeId={employeeId ?? undefined}
        onSuccess={() => void refetch()}
      />

      <MyFilePreviewDetailModal
        file={previewFile}
        open={Boolean(previewFile)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setPreviewFile(null);
        }}
        onDownload={handleDownload}
      />

      <MyFileEditDetailModal
        file={editFile}
        open={Boolean(editFile)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setEditFile(null);
        }}
        onUpdate={handleUpdateFile}
        isUpdating={isUpdating}
        employeeId={employeeId}
        onSuccess={() => void refetch()}
      />

      <FileDeleteDialog
        file={deleteTarget}
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />
    </>
  );
};
