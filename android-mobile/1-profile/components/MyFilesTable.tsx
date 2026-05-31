import { FileText, Image, Link as LinkIcon, MoreHorizontal, Trash2 } from 'lucide-react';
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
import {
  FILE_VISIBILITY,
  getFileExtension,
  type CompanyFile,
} from '@/2-8-dashboard/utils/fileTypes';
import { getLinkIcon } from '@/2-8-files/utils/linkUtils';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import {
  formatFileSize,
  formatMyFileUploadDate,
  getFileCategoryLabel,
} from '@/mobile/1-profile/utils/myFilesDisplayUtils';
import type { ProfileMyFile } from '@/mobile/1-profile/hooks/useProfileMyFiles';

interface MyFilesTableProps {
  files: ProfileMyFile[];
  onViewDetails: (file: CompanyFile) => void;
  onEditFile: (file: CompanyFile) => void;
  onDeleteFile: (file: CompanyFile) => void;
}

function getFileIcon(file: ProfileMyFile) {
  if (file.source_type === 'link') return LinkIcon;
  if (file.mime_type.startsWith('image/')) return Image;
  return FileText;
}

export const MyFilesTable = ({
  files,
  onViewDetails,
  onEditFile,
  onDeleteFile,
}: MyFilesTableProps) => {
  const { t } = useAppTranslation();
  const { language } = useLanguage();

  return (
    <div className="scrollbar-hide seamless-scroll nested-scroll-touch-chain overflow-x-auto overflow-y-visible [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <Table className="min-w-[980px]">
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-[280px] whitespace-nowrap font-semibold text-foreground">
              {t('profile.myFiles.colFileNameLabel', 'File Name')}
            </TableHead>
            <TableHead className="w-[120px] whitespace-nowrap font-semibold text-foreground">
              {t('profile.myFiles.colCategoryLabel', 'Category')}
            </TableHead>
            <TableHead className="w-[100px] whitespace-nowrap font-semibold text-foreground">
              {t('profile.myFiles.colSizeLabel', 'Size')}
            </TableHead>
            <TableHead className="w-[100px] whitespace-nowrap font-semibold text-foreground">
              {t('profile.myFiles.colTypeLabel', 'Type')}
            </TableHead>
            <TableHead className="w-[120px] whitespace-nowrap font-semibold text-foreground">
              {t('profile.myFiles.colVisibilityLabel', 'Visibility')}
            </TableHead>
            <TableHead className="w-[150px] whitespace-nowrap font-semibold text-foreground">
              {t('profile.myFiles.colOwnerLabel', 'Owner')}
            </TableHead>
            <TableHead className="w-[120px] whitespace-nowrap font-semibold text-foreground">
              {t('profile.myFiles.colUploadDateLabel', 'Upload Date')}
            </TableHead>
            <TableHead className="w-[100px] whitespace-nowrap font-semibold text-foreground">
              {t('profile.myFiles.colActionsLabel', 'Actions')}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {files.map((file) => {
            const FileIcon = getFileIcon(file);

            return (
              <TableRow key={file.id} className="hover:bg-muted/50">
                <TableCell className="font-medium">
                  <div className="flex items-center gap-3">
                    <div
                      className={`rounded-md p-2 ${file.source_type === 'link' ? 'bg-info-muted' : 'bg-muted'}`}
                    >
                      {file.source_type === 'link' ? (
                        <span className="text-lg">{getLinkIcon(file.file_path)}</span>
                      ) : (
                        <FileIcon className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium leading-tight text-foreground">
                          {file.file_name}
                        </p>
                        {file.source_type === 'link' && (
                          <Badge
                            variant="outline"
                            className="shrink-0 border-border bg-info-muted text-xs text-info-foreground"
                          >
                            {t('profile.myFiles.linkBadge', 'Link')}
                          </Badge>
                        )}
                      </div>
                      {file.description && (
                        <p className="line-clamp-1 text-xs text-muted-foreground">{file.description}</p>
                      )}
                      {file.source_type === 'link' && file.link_description && (
                        <p className="line-clamp-1 text-xs text-muted-foreground">
                          {file.link_description}
                        </p>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {getFileCategoryLabel(file.file_category, t)}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {file.source_type === 'link' ? (
                    <span className="text-xs text-muted-foreground/70">—</span>
                  ) : (
                    formatFileSize(file.file_size || 0)
                  )}
                </TableCell>
                <TableCell>
                  {file.source_type === 'link' ? (
                    <Badge
                      variant="secondary"
                      className="whitespace-nowrap bg-info-muted text-xs text-info-foreground"
                    >
                      LINK
                    </Badge>
                  ) : (
                    <Badge
                      variant="secondary"
                      className="max-w-[100px] truncate whitespace-nowrap text-xs"
                      title={getFileExtension(file.file_name)}
                    >
                      {getFileExtension(file.file_name)}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge
                    className="whitespace-nowrap bg-destructive/10 text-destructive"
                    variant="secondary"
                  >
                    {FILE_VISIBILITY[file.visibility]}
                  </Badge>
                </TableCell>
                <TableCell
                  className="max-w-[150px] truncate whitespace-nowrap"
                  title={file.owner_name}
                >
                  {file.owner_name}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {formatMyFileUploadDate(file.created_at, language)}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" aria-label={t('profile.myFiles.colActionsLabel', 'Actions')}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="border-border bg-popover shadow-lg">
                      <DropdownMenuItem onClick={() => onViewDetails(file)}>
                        {t('profile.myFiles.viewDetails', 'View Details')}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEditFile(file)}>
                        {t('profile.myFiles.editFile', 'Edit File')}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onDeleteFile(file)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {t('profile.myFiles.deleteFile', 'Delete')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};
