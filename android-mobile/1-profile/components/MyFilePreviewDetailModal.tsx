import { useEffect, useState, useCallback } from 'react';
import {
  Eye,
  Download,
  ExternalLink,
  FileText,
  Link as LinkIcon,
  Loader2,
} from 'lucide-react';
import { Dialog, DialogContent } from '@/shared/components/ui/dialog';
import { Button } from '@/mobile-app/components/ui/button';
import { Badge } from '@/mobile-app/components/ui/badge';
import { Card } from '@/mobile-app/components/ui/card';
import { supabase } from '@/shared/lib/supabaseClient';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useLanguage } from '@/shared/i18n/LanguageProvider';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import { MobileFormModalFooter } from '@/mobile-app/components/MobileFormModalFooter';
import {
  InfoFieldRow,
  InfoSection,
  ProfileDetailModalHeader,
  profileFullscreenDialogContentClass,
  profileFullscreenScrollBodyClass,
} from '@/mobile/1-profile/components/ProfileInfoModalParts';
import {
  formatFileSize,
  formatMyFileDetailDate,
  getFileCategoryLabel,
  getFileTypeLabel,
  getVisibilityLabel,
} from '@/mobile/1-profile/utils/myFilesDisplayUtils';
import { getLinkIcon } from '@/2-8-files/utils/linkUtils';
import {
  isImageFile,
  isPdfFile,
  type CompanyFile,
} from '@/2-8-dashboard/utils/fileTypes';
import { hasDisplayValue } from '@/mobile/1-profile/utils/myInfoDisplayUtils';

interface MyFilePreviewDetailModalProps {
  file: CompanyFile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDownload: (file: CompanyFile) => void;
}

export const MyFilePreviewDetailModal = ({
  file,
  open,
  onOpenChange,
  onDownload,
}: MyFilePreviewDetailModalProps) => {
  const { t } = useAppTranslation();
  const { language } = useLanguage();
  const isMobile = useIsMobile();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const handleClose = () => onOpenChange(false);

  const generatePreviewUrl = useCallback(async () => {
    if (!file || file.source_type === 'link') return;

    setIsLoadingPreview(true);
    try {
      const { data, error } = await supabase.storage
        .from('company-files')
        .createSignedUrl(file.file_path, 3600);

      if (error) throw error;
      setPreviewUrl(data.signedUrl);
    } catch {
      setPreviewUrl(null);
    } finally {
      setIsLoadingPreview(false);
    }
  }, [file]);

  useEffect(() => {
    if (!file || !open) {
      setPreviewUrl(null);
      setIsLoadingPreview(false);
      return;
    }

    if (file.source_type === 'link') {
      setPreviewUrl(file.file_path);
      setIsLoadingPreview(false);
      return;
    }

    void generatePreviewUrl();
  }, [file, open, generatePreviewUrl]);

  const renderPreviewContent = () => {
    if (!file) return null;

    if (file.source_type === 'link') {
      return (
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          {file.link_thumbnail_url ? (
            <img
              src={file.link_thumbnail_url}
              alt={file.link_title || file.file_name}
              className="max-h-48 w-full max-w-sm rounded-lg border border-border object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <div className="text-5xl">{getLinkIcon(file.file_path)}</div>
          )}
          <div className="w-full min-w-0 space-y-2">
            <p className="text-base font-semibold text-foreground break-words">
              {file.link_title || file.file_name}
            </p>
            {file.link_description && (
              <p className="text-sm text-muted-foreground break-words">{file.link_description}</p>
            )}
            <div className="flex items-start justify-center gap-2 text-xs text-muted-foreground">
              <LinkIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="break-all text-left">{file.file_path}</span>
            </div>
          </div>
        </div>
      );
    }

    if (isLoadingPreview) {
      return (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-primary" aria-hidden />
        </div>
      );
    }

    if (!previewUrl) {
      return (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <FileText className="h-10 w-10 text-muted-foreground/40" aria-hidden />
          <p className="text-sm text-muted-foreground">
            {t('profile.myFiles.previewUnavailable', 'Preview not available')}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => onDownload(file)}>
            <Download className="mr-2 h-4 w-4" />
            {t('profile.myFiles.downloadToView', 'Download to View')}
          </Button>
        </div>
      );
    }

    if (isImageFile(file.mime_type)) {
      return (
        <img
          src={previewUrl}
          alt={file.file_name}
          className="mx-auto max-h-[min(50vh,420px)] w-full rounded-lg object-contain"
        />
      );
    }

    if (isPdfFile(file.mime_type)) {
      return (
        <iframe
          src={previewUrl}
          className="h-[min(50vh,420px)] w-full rounded-lg border border-border bg-background"
          title={file.file_name}
        />
      );
    }

    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <FileText className="h-10 w-10 text-muted-foreground/40" aria-hidden />
        <p className="text-sm text-muted-foreground">
          {t('profile.myFiles.previewTypeUnavailable', 'Preview not available for this file type')}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => onDownload(file)}>
          <Download className="mr-2 h-4 w-4" />
          {t('profile.myFiles.downloadToView', 'Download to View')}
        </Button>
      </div>
    );
  };

  if (!file) return null;

  const infoFields = [
    {
      label: t('profile.myFiles.detailSizeLabel', 'Size'),
      value:
        file.source_type === 'link' ? '—' : formatFileSize(file.file_size || 0),
    },
    {
      label: t('profile.myFiles.detailCategoryLabel', 'Category'),
      value: getFileCategoryLabel(file.file_category, t),
    },
    {
      label: t('profile.myFiles.detailTypeLabel', 'Type'),
      value: getFileTypeLabel(file, t),
    },
    {
      label: t('profile.myFiles.detailVisibilityLabel', 'Visibility'),
      value: getVisibilityLabel(file.visibility, t),
    },
    {
      label: t('profile.myFiles.detailUploadDateLabel', 'Upload Date'),
      value: formatMyFileDetailDate(file.created_at, language),
    },
    {
      label: t('profile.myFiles.detailOwnerLabel', 'Owner'),
      value: file.owner_name,
    },
    ...(file.source_type === 'link' && file.link_modified_at
      ? [
          {
            label: t('profile.myFiles.detailModifiedLabel', 'Last Modified'),
            value: formatMyFileDetailDate(file.link_modified_at, language),
          },
        ]
      : []),
    ...(file.source_type === 'link' && file.link_owner
      ? [
          {
            label: t('profile.myFiles.detailDocOwnerLabel', 'Document Owner'),
            value: file.link_owner,
          },
        ]
      : []),
    ...(hasDisplayValue(file.description)
      ? [
          {
            label: t('profile.myFiles.detailDescriptionLabel', 'Description'),
            value: file.description,
          },
        ]
      : []),
  ].filter((field) => hasDisplayValue(field.value));

  const primaryAction =
    file.source_type === 'link' ? (
      <Button
        type="button"
        size={isMobile ? 'sm' : 'default'}
        className={isMobile ? 'min-w-[120px]' : 'w-full'}
        onClick={() => window.open(file.file_path, '_blank', 'noopener,noreferrer')}
      >
        <ExternalLink className="mr-2 h-4 w-4" />
        {t('profile.myFiles.openLinkButton', 'Open Link')}
      </Button>
    ) : (
      <Button
        type="button"
        size={isMobile ? 'sm' : 'default'}
        className={isMobile ? 'min-w-[120px]' : 'w-full'}
        onClick={() => onDownload(file)}
      >
        <Download className="mr-2 h-4 w-4" />
        {t('profile.myFiles.downloadButton', 'Download')}
      </Button>
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={profileFullscreenDialogContentClass(isMobile)}
        fullscreenAnimation={isMobile}
        hideCloseButton={isMobile}
      >
        <ProfileDetailModalHeader
          isMobile={isMobile}
          title={t('profile.myFiles.previewTitle', 'File Details')}
          icon={Eye}
          closeLabel={t('layout.sheetClose', 'Close')}
          onClose={handleClose}
        />

        <div className={isMobile ? 'flex min-h-0 flex-1 flex-col' : undefined}>
          <div className={profileFullscreenScrollBodyClass()}>
            <div className="mx-auto w-full max-w-md space-y-3 pb-2">
              <Card className="border border-border bg-gradient-card overflow-hidden">
                <div className="border-b border-border px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="min-w-0 flex-1 text-sm font-semibold text-foreground break-words">
                      {file.file_name}
                    </h2>
                    {file.source_type === 'link' && (
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        {t('profile.myFiles.linkBadge', 'Link')}
                      </Badge>
                    )}
                  </div>
                  {file.original_name !== file.file_name && hasDisplayValue(file.original_name) && (
                    <p className="mt-1 text-xs text-muted-foreground break-all">{file.original_name}</p>
                  )}
                </div>
                <div className="bg-muted/30 px-3 py-4">{renderPreviewContent()}</div>
              </Card>

              {infoFields.length > 0 && (
                <InfoSection
                  title={t('profile.myFiles.infoSection', 'File Information')}
                  hasContent={infoFields.length > 0}
                >
                  {infoFields.map((field) => (
                    <InfoFieldRow key={field.label} label={field.label} value={field.value} />
                  ))}
                </InfoSection>
              )}
            </div>
          </div>

          {isMobile ? (
            <MobileFormModalFooter>{primaryAction}</MobileFormModalFooter>
          ) : (
            <div className="flex-shrink-0 border-t bg-muted/30 px-6 pb-6 pt-4">
              <div className="flex justify-end">{primaryAction}</div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
