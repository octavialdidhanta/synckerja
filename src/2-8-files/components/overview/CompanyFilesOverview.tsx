
import { Card } from '@/shared/components/ui/card';
import { FileText, Clock } from 'lucide-react';
import { useCompanyFiles } from '@/2-8-files/hooks/useCompanyFiles';
import { format } from 'date-fns';
import { StorageUsageCard } from '@/shared/storage/StorageUsageCard';

export const CompanyFilesOverview = () => {
  const { files } = useCompanyFiles();

  const recentFiles = files.slice(0, 5);

  return (
    <div className="space-y-4">
      {/* Real organization-wide storage against the plan quota (was a fixed 45% placeholder). */}
      <StorageUsageCard compact />

      <Card className="p-4">
        <div className="mb-3 flex items-center gap-3">
          <Clock className="h-5 w-5 text-success-foreground" />
          <h4 className="font-medium text-foreground">Recent Files</h4>
        </div>
        <div className="space-y-3">
          {recentFiles.map((file) => (
            <div key={file.id} className="flex items-center gap-3">
              <div className="rounded bg-muted p-1.5">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-foreground">{file.file_name}</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(file.created_at), 'MMM dd, HH:mm')}
                </p>
              </div>
            </div>
          ))}
          {recentFiles.length === 0 && (
            <p className="py-4 text-center text-xs text-muted-foreground">No files uploaded yet</p>
          )}
        </div>
      </Card>
    </div>
  );
};
