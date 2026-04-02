import React from 'react';
import { FileText, Image, Folder, HardDrive } from 'lucide-react';
import { useCompanyFiles } from '@/2-8-files/hooks/useCompanyFiles';

export const CompanyFilesMetricsCards = () => {
  const { files } = useCompanyFiles();

  const totalFiles = files.length;
  const totalSize = files.reduce((acc, file) => acc + (file.file_size || 0), 0);
  const imageFiles = files.filter(file => file.mime_type?.startsWith('image/')).length;
  const documentFiles = files.filter(file => !file.mime_type?.startsWith('image/')).length;

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const statsCards = [
    {
      title: 'Total Files',
      value: totalFiles.toString(),
      subtitle: 'All files',
      icon: FileText,
      iconColor: 'text-primary',
      bgColor: 'bg-info-muted',
      borderColor: 'border-border'
    },
    {
      title: 'Total Size',
      value: formatSize(totalSize),
      subtitle: 'Storage used',
      icon: HardDrive,
      iconColor: 'text-success-foreground',
      bgColor: 'bg-success-muted',
      borderColor: 'border-border'
    },
    {
      title: 'Images',
      value: imageFiles.toString(),
      subtitle: 'Image files',
      icon: Image,
      iconColor: 'text-accent-foreground',
      bgColor: 'bg-accent',
      borderColor: 'border-border'
    },
    {
      title: 'Documents',
      value: documentFiles.toString(),
      subtitle: 'Document files',
      icon: Folder,
      iconColor: 'text-warning-foreground',
      bgColor: 'bg-warning-muted',
      borderColor: 'border-border'
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-1.5">
      {statsCards.map((stat, index) => (
        <div key={index} className={`${stat.bgColor} ${stat.borderColor} border rounded-md p-4`}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground">{stat.title}</h3>
            <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
          </div>
          
          <div className="space-y-1">
            <div className="text-2xl font-bold text-foreground">{stat.value}</div>
            <div className="text-xs text-muted-foreground">{stat.subtitle}</div>
          </div>
        </div>
      ))}
    </div>
  );
};
