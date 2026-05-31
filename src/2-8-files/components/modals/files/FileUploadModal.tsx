
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
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
import { Separator } from '@/shared/components/ui/separator';
import { Upload, X, FileText, AlertCircle, Link as LinkIcon, Loader2, Camera } from 'lucide-react';
import { FILE_CATEGORIES, FILE_VISIBILITY, FileSourceType } from '@/2-8-dashboard/utils/fileTypes';
import { validateFile } from '@/2-8-dashboard/utils/fileValidation';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useShowToast } from '@/shared/hooks/useShowToast';
import { useQueryClient } from '@tanstack/react-query';
import { isValidUrl, verifyUrlAccess, extractLinkMetadata, getLinkIcon } from '@/2-8-files/utils/linkUtils';
import { useIsMobile } from '@/shared/hooks/use-mobile';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { cn } from '@/shared/lib/utils';
import { Card } from '@/mobile-app/components/ui/card';
import { DrawerSelectField } from '@/mobile-app/components/DrawerSelectField';
import {
  ProfileDetailModalHeader,
  profileFullscreenDialogContentClass,
  profileFullscreenScrollBodyClass,
} from '@/mobile/1-profile/components/ProfileInfoModalParts';
import {
  getFileCategoryLabel,
  getVisibilityLabel,
} from '@/mobile/1-profile/utils/myFilesDisplayUtils';
import { CameraModal } from '@/mobile-app/components/CameraModal';
import { MobileFormModalFooter } from '@/mobile-app/components/MobileFormModalFooter';

function dataUrlToImageFile(dataUrl: string, fileName: string): File {
  const [meta, base64] = dataUrl.split(',');
  const mimeMatch = /data:(.*?);base64/.exec(meta ?? '');
  const mime = mimeMatch?.[1] || 'image/jpeg';
  const binary = atob(base64 ?? '');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], fileName, { type: mime });
}

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  forcedVisibility?: keyof typeof FILE_VISIBILITY;
  defaultEmployeeId?: string;
  onSuccess?: () => void;
}

export const FileUploadModal = ({
  isOpen,
  onClose,
  forcedVisibility,
  defaultEmployeeId,
  onSuccess,
}: FileUploadModalProps) => {
  const [sourceType, setSourceType] = useState<FileSourceType>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkMetadata, setLinkMetadata] = useState<any>(null);
  const [validatingLink, setValidatingLink] = useState(false);
  const [uploading, setUploading] = useState(false);
  const getDefaultFormData = () => ({
    file_name: '',
    file_category: 'dokumen' as keyof typeof FILE_CATEGORIES,
    visibility: (forcedVisibility ?? 'internal') as keyof typeof FILE_VISIBILITY,
    description: '',
  });

  const [formData, setFormData] = useState(getDefaultFormData);

  const { organizationId } = useCurrentOrg();
  const showToast = useShowToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const { t } = useAppTranslation();
  const [categoryDrawerOpen, setCategoryDrawerOpen] = useState(false);
  const [visibilityDrawerOpen, setVisibilityDrawerOpen] = useState(false);
  const [fileCameraOpen, setFileCameraOpen] = useState(false);

  const categoryOptions = useMemo(
    () =>
      (Object.keys(FILE_CATEGORIES) as (keyof typeof FILE_CATEGORIES)[]).map((key) => ({
        value: key,
        label: getFileCategoryLabel(key, t),
      })),
    [t],
  );

  const visibilityOptions = useMemo(
    () =>
      (Object.keys(FILE_VISIBILITY) as (keyof typeof FILE_VISIBILITY)[]).map((key) => ({
        value: key,
        label: getVisibilityLabel(key, t),
      })),
    [t],
  );

  const modalTitle =
    sourceType === 'upload'
      ? t('profile.myFiles.uploadButton', 'Upload File')
      : t('profile.myFiles.addLinkButton', 'Add Link');

  const submitDisabled =
    uploading ||
    !formData.file_name.trim() ||
    (sourceType === 'upload' && !file) ||
    (sourceType === 'link' && !linkUrl.trim());

  const applySelectedFile = useCallback(
    (selectedFile: File) => {
      const validation = validateFile(selectedFile);
      if (!validation.isValid) {
        showToast({
          title: t('common.error', 'Error'),
          description: validation.error,
          variant: 'destructive',
        });
        return false;
      }
      setFile(selectedFile);
      const baseName = selectedFile.name.includes('.')
        ? selectedFile.name.split('.').slice(0, -1).join('.')
        : selectedFile.name;
      setFormData((prev) => ({
        ...prev,
        file_name: baseName,
        file_category:
          selectedFile.type.startsWith('image/') && prev.file_category === 'dokumen'
            ? 'gambar'
            : prev.file_category,
      }));
      return true;
    },
    [showToast, t],
  );

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      applySelectedFile(selectedFile);
      event.target.value = '';
    }
  };

  const handleCameraCapture = useCallback(
    (imageData: string) => {
      try {
        const captured = dataUrlToImageFile(imageData, `photo_${Date.now()}.jpg`);
        if (applySelectedFile(captured)) {
          showToast({
            title: t('common.success', 'Success'),
            description: t('profile.myFiles.photoTaken', 'Photo captured successfully'),
          });
        }
      } catch {
        showToast({
          title: t('common.error', 'Error'),
          description: t('profile.myFiles.photoCaptureFailed', 'Failed to capture photo'),
          variant: 'destructive',
        });
      } finally {
        setFileCameraOpen(false);
      }
    },
    [applySelectedFile, showToast, t],
  );

  const handleLinkChange = async (url: string) => {
    setLinkUrl(url);
    setLinkMetadata(null);
    
    if (!url.trim()) return;
    
    // Validate URL format
    if (!isValidUrl(url)) {
      showToast({
        title: 'Invalid URL',
        description: 'Please enter a valid URL (must start with http:// or https://)',
        variant: 'destructive'
      });
      return;
    }
    
    // Verify URL access and extract metadata
    setValidatingLink(true);
    try {
      const isAccessible = await verifyUrlAccess(url);
      if (!isAccessible) {
        showToast({
          title: 'Warning',
          description: 'Unable to verify URL accessibility. The link may still be valid.',
          variant: 'default'
        });
      }
      
      const metadata = await extractLinkMetadata(url);
      setLinkMetadata(metadata);
      
      // Auto-fill file name from metadata
      if (metadata.title && !formData.file_name) {
        setFormData(prev => ({
          ...prev,
          file_name: metadata.title
        }));
      }
      
      // Auto-fill description from metadata
      if (metadata.description && !formData.description) {
        setFormData(prev => ({
          ...prev,
          description: metadata.description
        }));
      }
    } catch (error: any) {
      console.error('Error extracting link metadata:', error);
      showToast({
        title: 'Warning',
        description: 'Could not extract metadata from link, but you can still save it.',
        variant: 'default'
      });
    } finally {
      setValidatingLink(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setLinkUrl('');
    setLinkMetadata(null);
    setSourceType('upload');
    setFormData(getDefaultFormData());
  };

  const handleUpload = async () => {
    if (!organizationId) return;
    
    // Validate based on source type
    if (sourceType === 'upload' && !file) return;
    if (sourceType === 'link' && !linkUrl.trim()) return;
    if (!formData.file_name.trim()) return;

    setUploading(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', user.id)
        .single();

      // Get employee_id if exists (for private files)
      let employeeId: string | null = defaultEmployeeId ?? null;
      if (!employeeId && formData.visibility === 'privat') {
        const { data: employee } = await supabase
          .from('employees')
          .select('id')
          .eq('user_id', user.id)
          .eq('organization_id', organizationId)
          .maybeSingle();

        employeeId = employee?.id || null;
      }

      let insertData: any = {
        organization_id: organizationId,
        file_name: formData.file_name,
        file_category: formData.file_category,
        description: formData.description,
        visibility: formData.visibility,
        owner_id: user.id,
        owner_name: profile?.full_name || user.email || 'Unknown',
        source_type: sourceType
      };

      if (sourceType === 'upload') {
        if (!file) throw new Error('File is required');
        
        // Generate unique file path based on visibility
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 8);
        const fileExt = file.name.split('.').pop();
        const fileName = `${formData.file_name}_${timestamp}_${randomString}.${fileExt}`;
        
        let filePath: string;
        if (formData.visibility === 'privat') {
          const identifierId = employeeId || user.id;
          filePath = `${organizationId}/private/${identifierId}/${fileName}`;
        } else {
          filePath = `${organizationId}/${fileName}`;
        }
        
        insertData.original_name = file.name;
        insertData.file_path = filePath;
        insertData.file_size = file.size;
        insertData.mime_type = file.type;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('company-files')
          .upload(filePath, file);

        if (uploadError) throw uploadError;
        
        if (employeeId && formData.visibility === 'privat') {
          insertData.employee_id = employeeId;
        }
      } else {
        // For links
        if (!linkUrl.trim()) throw new Error('Link URL is required');
        
        insertData.original_name = linkMetadata?.title || 'External Link';
        insertData.file_path = linkUrl; // Store URL in file_path
        insertData.file_size = null; // Links have no file size
        insertData.mime_type = linkMetadata?.mimeType || 'text/html';
        
        // Add link metadata
        if (linkMetadata) {
          insertData.link_title = linkMetadata.title;
          insertData.link_description = linkMetadata.description;
          insertData.link_modified_at = linkMetadata.modifiedAt || null;
          insertData.link_owner = linkMetadata.owner || null;
          insertData.link_thumbnail_url = linkMetadata.thumbnailUrl || null;
        }
        
        if (employeeId && formData.visibility === 'privat') {
          insertData.employee_id = employeeId;
        }
      }

      // Save to database
      const { error: dbError } = await supabase
        .from('company_files')
        .insert(insertData);

      if (dbError) throw dbError;

      // Refresh the files list
      queryClient.invalidateQueries({ queryKey: ['company-files'] });
      onSuccess?.();

      showToast({
        title: 'Success',
        description: sourceType === 'upload' ? 'File uploaded successfully' : 'Link added successfully',
      });

      // Reset form and close modal
      resetForm();
      onClose();

    } catch (error: any) {
      console.error('Upload error:', error);
      showToast({
        title: 'Error',
        description: sourceType === 'upload' ? 'Failed to upload file' : 'Failed to add link',
        variant: 'destructive'
      });
    } finally {
      setUploading(false);
    }
  };

  const removeFile = () => {
    setFile(null);
    setFormData(prev => ({ ...prev, file_name: '' }));
  };

  const removeLink = () => {
    setLinkUrl('');
    setLinkMetadata(null);
    setFormData(prev => ({ ...prev, file_name: '', description: '' }));
  };

  useEffect(() => {
    if (!isOpen) {
      resetForm();
      setCategoryDrawerOpen(false);
      setVisibilityDrawerOpen(false);
      setFileCameraOpen(false);
    }
  }, [isOpen]);

  const renderCategoryField = () => {
    if (isMobile) {
      return (
        <DrawerSelectField
          open={categoryDrawerOpen}
          onOpenChange={setCategoryDrawerOpen}
          title={t('profile.myFiles.editCategoryLabel', 'Category')}
          value={formData.file_category}
          placeholder={t('profile.myFiles.editCategoryPlaceholder', 'Select category')}
          options={categoryOptions}
          onSelect={(value) =>
            setFormData((prev) => ({ ...prev, file_category: value as keyof typeof FILE_CATEGORIES }))
          }
          disabled={uploading}
        />
      );
    }

    return (
      <Select
        value={formData.file_category}
        onValueChange={(value) => setFormData((prev) => ({ ...prev, file_category: value as any }))}
      >
        <SelectTrigger id="file_category">
          <SelectValue placeholder="Select category" />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(FILE_CATEGORIES).map(([key, label]) => (
            <SelectItem key={key} value={key}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  const renderVisibilityField = () => {
    if (isMobile) {
      return (
        <DrawerSelectField
          open={visibilityDrawerOpen}
          onOpenChange={setVisibilityDrawerOpen}
          title={t('profile.myFiles.colVisibilityLabel', 'Visibility')}
          value={formData.visibility}
          placeholder={t('profile.myFiles.colVisibilityLabel', 'Visibility')}
          options={visibilityOptions}
          onSelect={(value) =>
            setFormData((prev) => ({ ...prev, visibility: value as keyof typeof FILE_VISIBILITY }))
          }
          disabled={uploading}
        />
      );
    }

    return (
      <Select
        value={formData.visibility}
        onValueChange={(value) => setFormData((prev) => ({ ...prev, visibility: value as any }))}
      >
        <SelectTrigger id="visibility">
          <SelectValue placeholder="Select visibility" />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(FILE_VISIBILITY).map(([key, label]) => (
            <SelectItem key={key} value={key}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  const typeToggleSection = (
    <div className="space-y-2">
      <Label className="text-sm font-medium">
        {t('profile.myFiles.typeLabel', 'Type')} <span className="text-destructive">*</span>
      </Label>
      <div className="flex gap-2">
        <Button
          type="button"
          variant={sourceType === 'upload' ? 'default' : 'outline'}
          onClick={() => {
            setSourceType('upload');
            setLinkUrl('');
            setLinkMetadata(null);
          }}
          disabled={uploading}
          className="h-10 flex-1 text-sm"
        >
          <Upload className="mr-2 h-4 w-4 shrink-0" />
          {t('profile.myFiles.uploadButton', 'Upload File')}
        </Button>
        <Button
          type="button"
          variant={sourceType === 'link' ? 'default' : 'outline'}
          onClick={() => {
            setSourceType('link');
            setFile(null);
          }}
          disabled={uploading}
          className="h-10 flex-1 text-sm"
        >
          <LinkIcon className="mr-2 h-4 w-4 shrink-0" />
          {t('profile.myFiles.addLinkButton', 'Add Link')}
        </Button>
      </div>
    </div>
  );

  const sourceSection =
    sourceType === 'upload' ? (
      <div className="space-y-2">
        <Label htmlFor="file-upload" className="text-sm font-medium">
          {t('profile.myFiles.selectFileLabel', 'Select File')} <span className="text-destructive">*</span>
        </Label>
        <input
          type="file"
          onChange={handleFileSelect}
          className="hidden"
          id="file-upload"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.webp"
          disabled={uploading}
        />
        {!file ? (
          isMobile ? (
            <div
              className={cn(
                'rounded-lg border-2 border-dashed border-input bg-muted/20 px-3 py-4',
                uploading && 'pointer-events-none opacity-60',
              )}
            >
              <div className="flex flex-col items-center gap-1 text-center">
                <Upload className="h-6 w-6 text-muted-foreground" aria-hidden />
                <p className="text-sm text-muted-foreground">
                  {t('profile.myFiles.selectFileHint', 'Tap to choose a file')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('profile.myFiles.selectFileFormats', 'PDF, DOC, XLS, PPT, Images up to 100MB')}
                </p>
              </div>
              <div className="mt-3 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setFileCameraOpen(true)}
                  disabled={uploading}
                  className="h-10 flex-1 text-sm"
                >
                  <Camera className="mr-2 h-4 w-4 shrink-0" />
                  {t('profile.myFiles.takePhoto', 'Take photo')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('file-upload')?.click()}
                  disabled={uploading}
                  className="h-10 flex-1 text-sm"
                >
                  <Upload className="mr-2 h-4 w-4 shrink-0" />
                  {t('profile.myFiles.chooseFile', 'Choose file')}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => document.getElementById('file-upload')?.click()}
              disabled={uploading}
              className="h-auto w-full border-2 border-dashed border-input py-6 transition-colors hover:border-primary/50"
            >
              <div className="flex flex-col items-center gap-2 px-2 text-center">
                {uploading ? (
                  <>
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">
                      {t('profile.myFiles.uploadingProgress', 'Uploading...')}
                    </span>
                  </>
                ) : (
                  <>
                    <Upload className="h-6 w-6 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {t('profile.myFiles.selectFileHint', 'Tap to choose a file')}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t('profile.myFiles.selectFileFormats', 'PDF, DOC, XLS, PPT, Images up to 100MB')}
                    </span>
                  </>
                )}
              </div>
            </Button>
          )
        ) : (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-success-muted p-3">
            <div className="flex min-w-0 items-center gap-2">
              <FileText className="h-4 w-4 shrink-0 text-success-foreground" />
              <span className="truncate text-sm font-medium text-foreground">{file.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={removeFile}
              className="h-8 w-8 shrink-0 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={uploading}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    ) : (
      <div className="space-y-2">
        <Label htmlFor="link-url" className="text-sm font-medium">
          {t('profile.myFiles.editLinkUrlLabel', 'Link URL')} <span className="text-destructive">*</span>
        </Label>
        <Input
          id="link-url"
          type="url"
          value={linkUrl}
          onChange={(e) => void handleLinkChange(e.target.value)}
          placeholder="https://docs.google.com/document/d/..."
          disabled={uploading || validatingLink}
          className="w-full"
        />
        {validatingLink && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{t('profile.myFiles.validatingLink', 'Validating link...')}</span>
          </div>
        )}
        {linkMetadata && (
          <div className="rounded-lg border border-border bg-success-muted p-3">
            <div className="flex items-start gap-3">
              <div className="text-2xl">{getLinkIcon(linkUrl)}</div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-foreground">{linkMetadata.title}</div>
                {linkMetadata.description && (
                  <div className="mt-1 text-xs text-muted-foreground">{linkMetadata.description}</div>
                )}
                {linkMetadata.owner && (
                  <div className="mt-1 text-xs text-muted-foreground/90">Owner: {linkMetadata.owner}</div>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={removeLink}
                className="h-8 w-8 shrink-0 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={uploading}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
        {linkUrl && !linkMetadata && !validatingLink && (
          <div className="flex items-center gap-2 text-sm text-warning-foreground">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{t('profile.myFiles.linkMetadataWarningDesc', 'Could not extract metadata. You can still save it.')}</span>
          </div>
        )}
      </div>
    );

  const metadataSection = (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="file_name" className="text-sm font-medium">
            {t('profile.myFiles.editFileNameLabel', 'File Name')} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="file_name"
            value={formData.file_name}
            onChange={(e) => setFormData((prev) => ({ ...prev, file_name: e.target.value }))}
            placeholder={t('profile.myFiles.editFileNamePlaceholder', 'Enter file name')}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="file_category" className="text-sm font-medium">
            {t('profile.myFiles.editCategoryLabel', 'Category')}
          </Label>
          {renderCategoryField()}
        </div>
      </div>

      {!forcedVisibility && (
        <div className="space-y-2">
          <Label htmlFor="visibility" className="text-sm font-medium">
            {t('profile.myFiles.colVisibilityLabel', 'Visibility')}
          </Label>
          {renderVisibilityField()}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="description" className="text-sm font-medium">
          {t('profile.myFiles.editDescriptionLabel', 'Description')}{' '}
          <span className="text-xs font-normal text-muted-foreground">
            ({t('profile.myFiles.optional', 'optional')})
          </span>
        </Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
          placeholder={t('profile.myFiles.editDescriptionPlaceholder', 'Enter description')}
          className="min-h-[96px] resize-none"
        />
      </div>
    </div>
  );

  const renderFormBody = () => {
    if (isMobile) {
      return (
        <div className="mx-auto w-full max-w-md space-y-3 pb-2">
          <Card className="border border-border bg-gradient-card">
            <div className="space-y-4 p-3">
              <h3 className="text-sm font-semibold text-foreground">
                {t('profile.myFiles.uploadSourceSection', 'Source')}
              </h3>
              {typeToggleSection}
              {sourceSection}
            </div>
          </Card>
          <Card className="border border-border bg-gradient-card">
            <div className="space-y-4 p-3">
              <h3 className="text-sm font-semibold text-foreground">
                {t('profile.myFiles.infoSection', 'File Information')}
              </h3>
              {metadataSection}
            </div>
          </Card>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {typeToggleSection}
        <Separator />
        {sourceSection}
        <Separator />
        {metadataSection}
      </div>
    );
  };

  const renderFooter = () => {
    if (isMobile) {
      return (
        <MobileFormModalFooter>
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={uploading}>
            {t('profile.myFiles.cancelButton', 'Cancel')}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleUpload}
            disabled={submitDisabled}
            className="flex min-w-[120px] items-center justify-center gap-1.5"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {sourceType === 'upload'
                  ? t('profile.myFiles.uploadingProgress', 'Uploading...')
                  : t('profile.myFiles.savingProgress', 'Saving...')}
              </>
            ) : (
              modalTitle
            )}
          </Button>
        </MobileFormModalFooter>
      );
    }

    return (
      <div className="flex-shrink-0 border-t bg-muted/30 px-6 pb-6 pt-4">
        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={uploading}>
            {t('profile.myFiles.cancelButton', 'Cancel')}
          </Button>
          <Button type="button" onClick={handleUpload} disabled={submitDisabled} className="min-w-[120px]">
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {sourceType === 'upload'
                  ? t('profile.myFiles.uploadingProgress', 'Uploading...')
                  : t('profile.myFiles.savingProgress', 'Saving...')}
              </>
            ) : (
              modalTitle
            )}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          isMobile
            ? profileFullscreenDialogContentClass(true)
            : 'flex h-[600px] max-h-[90vh] w-[600px] max-w-[90vw] flex-col p-0',
        )}
        fullscreenAnimation={isMobile}
        hideCloseButton={isMobile}
      >
        {isMobile ? (
          <ProfileDetailModalHeader
            isMobile
            title={modalTitle}
            icon={Upload}
            closeLabel={t('layout.sheetClose', 'Close')}
            onClose={onClose}
          />
        ) : (
          <DialogHeader className="flex-shrink-0 border-b border-border bg-gradient-to-r from-accent/80 to-primary/5 px-6 pb-4 pt-6 dark:from-accent/20 dark:to-primary/10">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Upload className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl font-semibold">{modalTitle}</DialogTitle>
                <DialogDescription className="mt-1 text-sm text-muted-foreground">
                  {sourceType === 'upload'
                    ? t(
                        'profile.myFiles.uploadSubtitle',
                        'Upload and manage company files and documents',
                      )
                    : t(
                        'profile.myFiles.addLinkSubtitle',
                        'Add external links (Google Docs, Dropbox, etc.)',
                      )}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        )}

        <div className={cn(isMobile && 'flex min-h-0 flex-1 flex-col')}>
          <div
            className={cn(
              isMobile
                ? profileFullscreenScrollBodyClass()
                : 'flex-1 overflow-y-auto px-6 py-6',
            )}
            style={
              isMobile
                ? undefined
                : {
                    scrollbarWidth: 'thin',
                    scrollBehavior: 'smooth',
                    scrollbarColor: '#d1d5db transparent',
                  }
            }
          >
            {renderFormBody()}
          </div>
          {renderFooter()}
        </div>

        {isMobile && (
          <CameraModal
            isOpen={fileCameraOpen}
            onClose={() => setFileCameraOpen(false)}
            onCapture={handleCameraCapture}
            title={t('profile.myFiles.fileCameraTitle', 'Take photo')}
            facingMode="environment"
            overlayClassName="z-[70]"
            contentClassName="z-[70]"
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
