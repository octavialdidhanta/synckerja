import React from 'react';

interface CompanyFilesTableFooterProps {
  totalFiles: number;
  filteredFiles?: number;
  totalSize: number;
}

export const CompanyFilesTableFooter: React.FC<CompanyFilesTableFooterProps> = ({
  totalFiles,
  filteredFiles,
  totalSize,
}) => {
  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const displayCount = filteredFiles ?? totalFiles;

  return (
    <div className="flex-shrink-0 border-t border-border bg-muted/50 px-4 py-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Showing {displayCount} of {totalFiles} files
        </span>
        <span className="text-xs text-muted-foreground/80">
          Total size: {formatSize(totalSize)}
        </span>
      </div>
    </div>
  );
};
