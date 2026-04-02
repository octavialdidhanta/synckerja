
import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { MoreHorizontal, Download, Edit, Trash2, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { CompanyFile, formatFileSize, getFileExtension, FILE_CATEGORIES, FILE_VISIBILITY } from '@/2-8-dashboard/utils/fileTypes';

interface FileTableProps {
  files: CompanyFile[];
  isLoading: boolean;
  onEdit: (file: CompanyFile) => void;
  onDelete: (file: CompanyFile) => void;
  onDownload: (file: CompanyFile) => void;
  onPreview: (file: CompanyFile) => void;
}

export const FileTable = ({ 
  files, 
  isLoading, 
  onEdit, 
  onDelete, 
  onDownload, 
  onPreview 
}: FileTableProps) => {
  const getVisibilityBadgeColor = (visibility: string) => {
    switch (visibility) {
      case 'internal':
        return 'bg-info-muted text-info-foreground';
      case 'privat':
        return 'bg-destructive/10 text-destructive';
      default:
        return 'bg-neutral-muted text-neutral-status';
    }
  };

  const getCategoryBadgeColor = (category: string) => {
    switch (category) {
      case 'dokumen':
        return 'bg-info-muted text-info-foreground';
      case 'gambar':
        return 'bg-success-muted text-success-foreground';
      case 'pdf':
        return 'bg-warning-muted text-warning-foreground';
      default:
        return 'bg-neutral-muted text-neutral-status';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded bg-muted" />
        ))}
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-lg text-muted-foreground">No files found</p>
        <p className="mt-2 text-sm text-muted-foreground/80">Try adjusting your search or filters</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="font-semibold text-foreground">File Name</TableHead>
            <TableHead className="font-semibold text-foreground">Category</TableHead>
            <TableHead className="font-semibold text-foreground">Size</TableHead>
            <TableHead className="font-semibold text-foreground">Uploaded by</TableHead>
            <TableHead className="font-semibold text-foreground">Visibility</TableHead>
            <TableHead className="font-semibold text-foreground">Upload Date</TableHead>
            <TableHead className="font-semibold text-foreground">Last Modified</TableHead>
            <TableHead className="font-semibold text-foreground">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {files.map((file) => (
            <TableRow key={file.id} className="hover:bg-muted/50">
              <TableCell>
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <div className="flex h-8 w-8 items-center justify-center rounded bg-info-muted">
                      <span className="text-xs font-medium text-info-foreground">
                        {getFileExtension(file.original_name)}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{file.file_name}</p>
                    <p className="text-sm text-muted-foreground">{file.original_name}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge className={getCategoryBadgeColor(file.file_category)} variant="secondary">
                  {FILE_CATEGORIES[file.file_category]}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatFileSize(file.file_size)}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {file.owner_name}
              </TableCell>
              <TableCell>
                <Badge className={getVisibilityBadgeColor(file.visibility)} variant="secondary">
                  {FILE_VISIBILITY[file.visibility]}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {format(new Date(file.created_at), 'dd/MM/yyyy HH:mm')}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {format(new Date(file.updated_at), 'dd/MM/yyyy HH:mm')}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="border-border bg-popover shadow-lg">
                    <DropdownMenuItem onClick={() => onPreview(file)}>
                      <Eye className="h-4 w-4 mr-2" />
                      Preview
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onDownload(file)}>
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onEdit(file)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => onDelete(file)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
