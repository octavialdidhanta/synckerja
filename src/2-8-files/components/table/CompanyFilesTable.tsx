import React, { useState, useCallback } from 'react';
import {
  Table,
  TableBody,
} from '@/shared/components/ui/table';
import { useCompanyFiles } from '@/2-8-files/hooks/useCompanyFiles';
import { FilePreviewModal } from '@/2-8-files/components/modals/files/FilePreviewModal';
import { FileEditModal } from '@/2-8-files/components/modals/files/FileEditModal';
import { FileDeleteDialog } from '@/2-8-files/components/modals/files/FileDeleteDialog';
import { CompanyFile } from '@/2-8-dashboard/utils/fileTypes';
import { CompanyFilesTableHeader } from './files-table/CompanyFilesTableHeader';
import { FileRow } from './files-table/FileRow';
import { CompanyFilesEmptyState } from './files-table/CompanyFilesEmptyState';
import { CompanyFilesTableFooter } from './files-table/CompanyFilesTableFooter';

interface CompanyFilesTableProps {
  onUploadFile?: () => void;
}

export const CompanyFilesTable = ({ onUploadFile }: CompanyFilesTableProps) => {
  const { files, isLoading, deleteFile, updateFile, downloadFile, isDeleting, isUpdating } = useCompanyFiles();
  const [previewFile, setPreviewFile] = useState<CompanyFile | null>(null);
  const [editFile, setEditFile] = useState<CompanyFile | null>(null);
  const [deleteFile_, setDeleteFile] = useState<CompanyFile | null>(null);

  const handleViewDetails = useCallback((file: CompanyFile) => {
    setPreviewFile(file);
  }, []);

  const handleEditFile = useCallback((file: CompanyFile) => {
    setEditFile(file);
  }, []);

  const handleDeleteFile = useCallback((file: CompanyFile) => {
    setDeleteFile(file);
  }, []);

  const handleDownload = useCallback((file: CompanyFile) => {
    downloadFile(file);
  }, [downloadFile]);

  const handleConfirmDelete = async () => {
    if (deleteFile_) {
      await deleteFile(deleteFile_.id);
      setDeleteFile(null);
    }
  };

  const handleUpdateFile = async (id: string, metadata: any) => {
    await updateFile({ id, metadata });
    setEditFile(null);
  };

  const hasFiles = files.length > 0;

  if (isLoading || !hasFiles) {
    return <CompanyFilesEmptyState isLoading={isLoading} hasFiles={hasFiles} onUploadFile={onUploadFile} />;
  }

  // Calculate total file size
  const totalSize = files.reduce((acc, file) => acc + (file.file_size || 0), 0);

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Scrollable Table Content */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden seamless-scroll nested-scroll-touch-chain">
          <div className="border rounded-t-lg overflow-hidden">
            <Table>
              <CompanyFilesTableHeader />
              <TableBody>
                {files.map((file) => (
                  <FileRow
                    key={file.id}
                    file={file}
                    onViewDetails={handleViewDetails}
                    onEditFile={handleEditFile}
                    onDeleteFile={handleDeleteFile}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
        
        {/* Fixed Footer */}
        <CompanyFilesTableFooter
          totalFiles={files.length}
          totalSize={totalSize}
        />
      </div>

      {/* Modals */}
      <FilePreviewModal
        file={previewFile}
        isOpen={!!previewFile}
        onClose={() => setPreviewFile(null)}
        onDownload={handleDownload}
      />

      <FileEditModal
        file={editFile}
        isOpen={!!editFile}
        onClose={() => setEditFile(null)}
        onUpdate={handleUpdateFile}
        isUpdating={isUpdating}
      />

      <FileDeleteDialog
        file={deleteFile_}
        isOpen={!!deleteFile_}
        onClose={() => setDeleteFile(null)}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />
    </>
  );
};
