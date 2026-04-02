
import React from 'react';
import { TableCell, TableRow } from '@/shared/components/ui/table';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { MoreHorizontal, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { formatFileSize, getFileExtension, FILE_CATEGORIES, FILE_VISIBILITY } from '@/2-8-dashboard/utils/fileTypes';
import { FileText, Image, Link as LinkIcon } from 'lucide-react';
import { CompanyFile } from '@/2-8-dashboard/utils/fileTypes';
import { getLinkIcon } from '@/2-8-files/utils/linkUtils';

interface FileRowProps {
  file: CompanyFile;
  onViewDetails: (file: CompanyFile) => void;
  onEditFile: (file: CompanyFile) => void;
  onDeleteFile: (file: CompanyFile) => void;
}

export const FileRow = ({ file, onViewDetails, onEditFile, onDeleteFile }: FileRowProps) => {
  const getVisibilityColor = (visibility: keyof typeof FILE_VISIBILITY) => {
    switch (visibility) {
      case 'internal':
        return 'bg-info-muted text-info-foreground';
      case 'privat':
        return 'bg-destructive/10 text-destructive';
      default:
        return 'bg-neutral-muted text-neutral-status';
    }
  };

  const getFileIcon = (file: CompanyFile) => {
    // For links, show link icon
    if (file.source_type === 'link') {
      return LinkIcon;
    }
    // For uploaded files
    if (file.mime_type.startsWith('image/')) {
      return Image;
    }
    return FileText;
  };

  const FileIcon = getFileIcon(file);

  return (
    <TableRow className="hover:bg-muted/50">
      <TableCell className="font-medium">
        <div className="flex items-center gap-3">
          <div className={`rounded-md p-2 ${file.source_type === 'link' ? 'bg-info-muted' : 'bg-muted'}`}>
            {file.source_type === 'link' ? (
              <span className="text-lg">{getLinkIcon(file.file_path)}</span>
            ) : (
              <FileIcon className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium leading-tight text-foreground">
                {file.file_name}
              </p>
              {file.source_type === 'link' && (
                <Badge variant="outline" className="border-border bg-info-muted text-xs text-info-foreground">
                  Link
                </Badge>
              )}
            </div>
            {file.description && (
              <p className="line-clamp-1 text-xs text-muted-foreground">{file.description}</p>
            )}
            {file.source_type === 'link' && file.link_description && (
              <p className="line-clamp-1 text-xs text-muted-foreground">{file.link_description}</p>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell className="whitespace-nowrap">{FILE_CATEGORIES[file.file_category]}</TableCell>
      <TableCell className="whitespace-nowrap">
        {file.source_type === 'link' ? (
          <span className="text-xs text-muted-foreground/70">—</span>
        ) : (
          formatFileSize(file.file_size || 0)
        )}
      </TableCell>
      <TableCell>
        {file.source_type === 'link' ? (
          <Badge variant="secondary" className="whitespace-nowrap bg-info-muted text-xs text-info-foreground">
            LINK
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-xs whitespace-nowrap max-w-[100px] truncate" title={getFileExtension(file.file_name)}>
            {getFileExtension(file.file_name)}
          </Badge>
        )}
      </TableCell>
      <TableCell>
        <Badge className={`${getVisibilityColor(file.visibility)} whitespace-nowrap`} variant="secondary">
          {FILE_VISIBILITY[file.visibility]}
        </Badge>
      </TableCell>
      <TableCell className="whitespace-nowrap truncate max-w-[150px]" title={file.owner_name}>{file.owner_name}</TableCell>
      <TableCell className="whitespace-nowrap">
        {format(new Date(file.created_at), 'dd/MM/yyyy')}
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="border-border bg-popover shadow-lg">
            <DropdownMenuItem onClick={() => onViewDetails(file)}>
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEditFile(file)}>
              Edit File
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => onDeleteFile(file)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
};

