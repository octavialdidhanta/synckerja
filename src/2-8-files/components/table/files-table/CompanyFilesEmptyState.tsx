
import React from 'react';
import { FileText } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';

interface CompanyFilesEmptyStateProps {
  isLoading: boolean;
  hasFiles: boolean;
  onUploadFile?: () => void;
}

export const CompanyFilesEmptyState = ({ isLoading, hasFiles, onUploadFile }: CompanyFilesEmptyStateProps) => {
  if (isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-lg text-muted-foreground">Loading files...</p>
      </div>
    );
  }

  if (!hasFiles) {
    return (
      <div className="text-center py-12">
        <FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
        <p className="text-lg text-muted-foreground">No files found matching your criteria</p>
        <p className="mt-2 text-sm text-muted-foreground/80">Try adjusting your search or filters</p>
        {onUploadFile && (
          <Button 
            onClick={onUploadFile} 
            className="mt-4"
          >
            Upload File
          </Button>
        )}
      </div>
    );
  }

  return null;
};


