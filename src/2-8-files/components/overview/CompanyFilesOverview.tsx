
import { Card } from '@/shared/components/ui/card';
import { FileText, Clock, TrendingUp } from 'lucide-react';
import { useCompanyFiles } from '@/2-8-files/hooks/useCompanyFiles';
import { format } from 'date-fns';

export const CompanyFilesOverview = () => {
  const { files } = useCompanyFiles();

  const recentFiles = files.slice(0, 5);
  const totalSize = files.reduce((acc, file) => acc + file.file_size, 0);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="mb-3 flex items-center gap-3">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h4 className="font-medium text-foreground">Storage Usage</h4>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Used</span>
            <span className="font-medium text-foreground">{formatSize(totalSize)}</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted">
            <div className="h-2 rounded-full bg-primary" style={{ width: '45%' }} />
          </div>
          <p className="text-xs text-muted-foreground">45% of storage used</p>
        </div>
      </Card>

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
