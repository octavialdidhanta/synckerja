import { useEffect, useState } from 'react';
import { Edit, AlertCircle, Link as LinkIcon, Loader2 } from 'lucide-react';
import { Dialog, DialogContent } from '@/shared/components/ui/dialog';
import { Button } from '@/mobile-app/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Label } from '@/shared/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Card } from '@/mobile-app/components/ui/card';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { fileUploadSchema, type FileUploadData } from '@/2-8-dashboard/utils/fileValidation';
import { FILE_CATEGORIES, type CompanyFile } from '@/2-8-dashboard/utils/fileTypes';
import { isValidUrl, verifyUrlAccess, extractLinkMetadata } from '@/2-8-files/utils/linkUtils';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import { useToast } from '@/shared/hooks/use-toast';
import {
  ProfileDetailModalHeader,
  profileFullscreenDialogContentClass,
  profileFullscreenScrollBodyClass,
} from '@/mobile/1-profile/components/ProfileInfoModalParts';
import { getFileCategoryLabel } from '@/mobile/1-profile/utils/myFilesDisplayUtils';

interface MyFileEditDetailModalProps {
  file: CompanyFile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (id: string, metadata: Record<string, unknown>) => Promise<void>;
  isUpdating: boolean;
  employeeId?: string | null;
  onSuccess?: () => void;
}

export const MyFileEditDetailModal = ({
  file,
  open,
  onOpenChange,
  onUpdate,
  isUpdating,
  employeeId,
  onSuccess,
}: MyFileEditDetailModalProps) => {
  const { t } = useAppTranslation();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [linkUrl, setLinkUrl] = useState('');
  const [linkMetadata, setLinkMetadata] = useState<{
    title?: string;
    description?: string;
    modifiedAt?: string;
    owner?: string;
    thumbnailUrl?: string;
    mimeType?: string;
  } | null>(null);
  const [validatingLink, setValidatingLink] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset,
  } = useForm<FileUploadData>({
    resolver: zodResolver(fileUploadSchema),
  });

  const handleClose = () => onOpenChange(false);

  useEffect(() => {
    if (!file || !open) return;

    const displayName =
      file.source_type === 'link' && file.link_title ? file.link_title : file.file_name;

    reset({
      file_name: displayName,
      file_category: file.file_category,
      visibility: 'privat',
      description: file.description || '',
      expires_at: file.expires_at ? new Date(file.expires_at).toISOString().split('T')[0] : '',
    });

    if (file.source_type === 'link') {
      setLinkUrl(file.file_path);
      if (file.link_title || file.link_description) {
        setLinkMetadata({
          title: file.link_title ?? undefined,
          description: file.link_description ?? undefined,
          modifiedAt: file.link_modified_at ?? undefined,
          owner: file.link_owner ?? undefined,
          thumbnailUrl: file.link_thumbnail_url ?? undefined,
          mimeType: file.mime_type,
        });
      } else {
        setLinkMetadata(null);
      }
    } else {
      setLinkUrl('');
      setLinkMetadata(null);
    }
  }, [file, open, reset]);

  const handleLinkChange = async (url: string) => {
    setLinkUrl(url);
    setLinkMetadata(null);

    if (!url.trim()) return;

    if (!isValidUrl(url)) {
      toast({
        title: t('profile.myFiles.invalidUrlTitle', 'Invalid URL'),
        description: t(
          'profile.myFiles.invalidUrlDesc',
          'Please enter a valid URL (must start with http:// or https://)',
        ),
        variant: 'destructive',
      });
      return;
    }

    setValidatingLink(true);
    try {
      const isAccessible = await verifyUrlAccess(url);
      if (!isAccessible) {
        toast({
          title: t('profile.myFiles.linkWarningTitle', 'Warning'),
          description: t(
            'profile.myFiles.linkWarningDesc',
            'Unable to verify URL accessibility. The link may still be valid.',
          ),
        });
      }

      const metadata = await extractLinkMetadata(url);
      setLinkMetadata(metadata);

      if (metadata.title && !watch('file_name')) {
        setValue('file_name', metadata.title);
      }
    } catch {
      toast({
        title: t('profile.myFiles.linkWarningTitle', 'Warning'),
        description: t(
          'profile.myFiles.linkMetadataWarningDesc',
          'Could not extract metadata from link, but you can still save it.',
        ),
      });
    } finally {
      setValidatingLink(false);
    }
  };

  const onSubmit = async (data: FileUploadData) => {
    if (!file) return;

    try {
      const updateData: Record<string, unknown> = {
        file_name: data.file_name,
        file_category: data.file_category,
        visibility: 'privat',
        description: data.description,
        expires_at: data.expires_at ? new Date(data.expires_at).toISOString() : null,
        updated_at: new Date().toISOString(),
        employee_id: employeeId ?? null,
      };

      if (file.source_type === 'link') {
        updateData.link_title = data.file_name;

        if (linkUrl.trim() && linkUrl !== file.file_path) {
          updateData.file_path = linkUrl;

          if (linkMetadata) {
            updateData.link_description = linkMetadata.description;
            updateData.link_modified_at = linkMetadata.modifiedAt || null;
            updateData.link_owner = linkMetadata.owner || null;
            updateData.link_thumbnail_url = linkMetadata.thumbnailUrl || null;
            updateData.mime_type = linkMetadata.mimeType || file.mime_type;
          }
        }
      }

      await onUpdate(file.id, updateData);
      onSuccess?.();
      handleClose();
    } catch {
      toast({
        title: t('profile.myFiles.updateError', 'Error'),
        description: t('profile.myFiles.updateErrorDesc', 'Failed to update file'),
        variant: 'destructive',
      });
    }
  };

  if (!file) return null;

  const isLink = file.source_type === 'link';
  const title = isLink
    ? t('profile.myFiles.editTitleLink', 'Edit Link')
    : t('profile.myFiles.editTitle', 'Edit File');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={profileFullscreenDialogContentClass(isMobile)}
        fullscreenAnimation={isMobile}
        hideCloseButton={isMobile}
      >
        <ProfileDetailModalHeader
          isMobile={isMobile}
          title={title}
          icon={Edit}
          closeLabel={t('layout.sheetClose', 'Close')}
          onClose={handleClose}
        />

        <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
          <div className={profileFullscreenScrollBodyClass()}>
            <div className="mx-auto w-full max-w-md space-y-3 pb-2">
              <Card className="border border-border bg-gradient-card">
                <div className="space-y-4 p-3">
                  {isLink && (
                    <div className="space-y-2">
                      <Label htmlFor="link-url">
                        {t('profile.myFiles.editLinkUrlLabel', 'Link URL')}
                        <span className="ml-0.5 text-destructive">*</span>
                      </Label>
                      <Input
                        id="link-url"
                        type="url"
                        value={linkUrl}
                        onChange={(e) => void handleLinkChange(e.target.value)}
                        placeholder="https://docs.google.com/document/d/..."
                        disabled={isUpdating || validatingLink}
                        className="w-full"
                      />
                      {validatingLink && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                          <span>{t('profile.myFiles.validatingLink', 'Validating link...')}</span>
                        </div>
                      )}
                      {linkMetadata && (
                        <div className="rounded-lg border border-border bg-muted/40 p-3">
                          <div className="flex items-start gap-3">
                            <LinkIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-foreground break-words">
                                {linkMetadata.title || t('profile.myFiles.linkBadge', 'Link')}
                              </p>
                              {linkMetadata.description && (
                                <p className="mt-1 text-xs text-muted-foreground break-words">
                                  {linkMetadata.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="file_name">
                      {isLink
                        ? t('profile.myFiles.editLinkNameLabel', 'Link Name')
                        : t('profile.myFiles.editFileNameLabel', 'File Name')}
                      <span className="ml-0.5 text-destructive">*</span>
                    </Label>
                    <Input
                      id="file_name"
                      {...register('file_name')}
                      placeholder={
                        isLink
                          ? t('profile.myFiles.editLinkNamePlaceholder', 'Enter link name')
                          : t('profile.myFiles.editFileNamePlaceholder', 'Enter file name')
                      }
                      className={errors.file_name ? 'border-destructive' : ''}
                      disabled={isUpdating}
                    />
                    {errors.file_name && (
                      <p className="flex items-center gap-1 text-xs text-destructive">
                        <AlertCircle className="h-3 w-3 shrink-0" />
                        {errors.file_name.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="file_category">
                      {t('profile.myFiles.editCategoryLabel', 'Category')}
                    </Label>
                    <Select
                      value={watch('file_category')}
                      onValueChange={(value) =>
                        setValue('file_category', value as FileUploadData['file_category'])
                      }
                      disabled={isUpdating}
                    >
                      <SelectTrigger
                        id="file_category"
                        className={errors.file_category ? 'border-destructive' : ''}
                      >
                        <SelectValue placeholder={t('profile.myFiles.editCategoryPlaceholder', 'Select category')} />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(FILE_CATEGORIES) as Array<keyof typeof FILE_CATEGORIES>).map(
                          (key) => (
                            <SelectItem key={key} value={key}>
                              {getFileCategoryLabel(key, t)}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                    {errors.file_category && (
                      <p className="flex items-center gap-1 text-xs text-destructive">
                        <AlertCircle className="h-3 w-3 shrink-0" />
                        {errors.file_category.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">
                      {t('profile.myFiles.editDescriptionLabel', 'Description')}
                      <span className="ml-1 text-xs font-normal text-muted-foreground">
                        ({t('profile.myFiles.optional', 'optional')})
                      </span>
                    </Label>
                    <Textarea
                      id="description"
                      {...register('description')}
                      placeholder={t('profile.myFiles.editDescriptionPlaceholder', 'Enter description')}
                      className="min-h-[120px] resize-none"
                      disabled={isUpdating}
                    />
                    {errors.description && (
                      <p className="flex items-center gap-1 text-xs text-destructive">
                        <AlertCircle className="h-3 w-3 shrink-0" />
                        {errors.description.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="expires_at">
                      {t('profile.myFiles.editExpiryLabel', 'Expiry Date')}
                      <span className="ml-1 text-xs font-normal text-muted-foreground">
                        ({t('profile.myFiles.optional', 'optional')})
                      </span>
                    </Label>
                    <Input
                      id="expires_at"
                      type="date"
                      {...register('expires_at')}
                      disabled={isUpdating}
                    />
                    {errors.expires_at && (
                      <p className="flex items-center gap-1 text-xs text-destructive">
                        <AlertCircle className="h-3 w-3 shrink-0" />
                        {errors.expires_at.message}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            </div>
          </div>

          <div className="flex-shrink-0 border-t border-border bg-background/95 px-4 py-3 safe-area-bottom-lower backdrop-blur-sm">
            <div className="mx-auto flex w-full max-w-md flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="w-full sm:flex-1"
                onClick={handleClose}
                disabled={isUpdating}
              >
                {t('profile.myFiles.cancelButton', 'Cancel')}
              </Button>
              <Button type="submit" className="w-full sm:flex-1" disabled={isUpdating || validatingLink}>
                {isUpdating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    {t('profile.myFiles.updating', 'Updating...')}
                  </>
                ) : isLink ? (
                  t('profile.myFiles.updateLinkButton', 'Update Link')
                ) : (
                  t('profile.myFiles.updateButton', 'Update File')
                )}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
