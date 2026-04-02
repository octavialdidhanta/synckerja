import React from 'react';
import { FileText, Database } from 'lucide-react';

interface CompanyFilesTableFooterProps {
  totalFiles: number;
  filteredFiles?: number;
  totalSize: number;
}

export const CompanyFilesTableFooter: React.FC<CompanyFilesTableFooterProps> = ({
  totalFiles,
  filteredFiles,
  totalSize
}) => {
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const displayCount = filteredFiles !== undefined && filteredFiles !== totalFiles
    ? filteredFiles
    : totalFiles;

  const isFiltered = filteredFiles !== undefined && filteredFiles !== totalFiles;

  return (
    <div className="mt-4 flex-shrink-0 border-t border-border bg-muted/40 px-4 py-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <FileText className="h-3 w-3" />
            {isFiltered ? (
              <>Showing {displayCount} of {totalFiles} files</>
            ) : (
              <>Total: {totalFiles} files</>
            )}
          </span>
        </div>
        <span className="flex items-center gap-1 text-xs text-muted-foreground/80">
          <Database className="h-3 w-3" />
          Total Size: {formatSize(totalSize)}
        </span>
      </div>
    </div>
  );
};

