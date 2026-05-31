
import React from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Separator } from '@/shared/components/ui/separator';
import { Edit, AlertCircle, Link as LinkIcon, Loader2 } from 'lucide-react';
import { CompanyFile, FILE_CATEGORIES, FILE_VISIBILITY } from '@/2-8-dashboard/utils/fileTypes';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { fileUploadSchema, FileUploadData } from '@/2-8-dashboard/utils/fileValidation';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useCurrentUser } from '@/shared/hooks/useCurrentUser';
import { useCurrentEmployee } from '@/shared/hooks/useCurrentEmployee';
import { isValidUrl, verifyUrlAccess, extractLinkMetadata } from '@/2-8-files/utils/linkUtils';
import { useShowToast } from '@/shared/hooks/useShowToast';

interface FileEditModalProps {
  file: CompanyFile | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (id: string, metadata: any) => Promise<void>;
  isUpdating: boolean;
  lockVisibility?: boolean;
  onSuccess?: () => void;
}

export const FileEditModal = ({ 
  file, 
  isOpen, 
  onClose, 
  onUpdate, 
  isUpdating,
  lockVisibility = false,
  onSuccess,
}: FileEditModalProps) => {
  const { organizationId } = useCurrentOrg();
  const { user } = useCurrentUser();
  const { data: employee } = useCurrentEmployee();
  const showToast = useShowToast();
  const [linkUrl, setLinkUrl] = React.useState('');
  const [linkMetadata, setLinkMetadata] = React.useState<any>(null);
  const [validatingLink, setValidatingLink] = React.useState(false);
  
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset
  } = useForm<FileUploadData>({
    resolver: zodResolver(fileUploadSchema)
  });

  const watchedVisibility = watch('visibility');

  React.useEffect(() => {
    if (file && isOpen) {
      // For links, use link_title if available, otherwise use file_name
      const displayName = file.source_type === 'link' && file.link_title 
        ? file.link_title 
        : file.file_name;
      
      reset({
        file_name: displayName,
        file_category: file.file_category,
        visibility: file.visibility,
        description: file.description || '',
        expires_at: file.expires_at ? new Date(file.expires_at).toISOString().split('T')[0] : ''
      });
      
      // Set link URL and metadata if it's a link
      if (file.source_type === 'link') {
        setLinkUrl(file.file_path);
        if (file.link_title || file.link_description) {
          setLinkMetadata({
            title: file.link_title,
            description: file.link_description,
            modifiedAt: file.link_modified_at,
            owner: file.link_owner,
            thumbnailUrl: file.link_thumbnail_url,
            mimeType: file.mime_type
          });
        }
      } else {
        setLinkUrl('');
        setLinkMetadata(null);
      }
    }
  }, [file, isOpen, reset]);

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
      
      // Auto-update file name if empty
      if (metadata.title && !watch('file_name')) {
        setValue('file_name', metadata.title);
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

  const onSubmit = async (data: FileUploadData) => {
    if (!file || !organizationId || !user) return;

    try {
      // Prepare update data
      const updateData: any = {
        file_name: data.file_name,
        file_category: data.file_category,
        visibility: data.visibility,
        description: data.description,
        expires_at: data.expires_at ? new Date(data.expires_at).toISOString() : null,
        updated_at: new Date().toISOString()
      };

      // For links, update URL and metadata if changed
      if (file.source_type === 'link') {
        // Always update link_title to match file_name when Link Name is changed
        updateData.link_title = data.file_name;
        
        if (linkUrl.trim() && linkUrl !== file.file_path) {
          updateData.file_path = linkUrl;
          
          // Update link metadata if available (but keep link_title from form)
          if (linkMetadata) {
            // Don't overwrite link_title - use the value from form (data.file_name)
            updateData.link_description = linkMetadata.description;
            updateData.link_modified_at = linkMetadata.modifiedAt || null;
            updateData.link_owner = linkMetadata.owner || null;
            updateData.link_thumbnail_url = linkMetadata.thumbnailUrl || null;
            updateData.mime_type = linkMetadata.mimeType || file.mime_type;
          }
        }
      }

      // Handle employee_id based on visibility change
      if (data.visibility === 'privat') {
        // If changing to private, get employee_id if user is an employee
        if (employee) {
          updateData.employee_id = employee.id;
        } else {
          // User is not an employee (e.g., owner/guest) - set employee_id to null
          updateData.employee_id = null;
        }
      } else if (data.visibility === 'internal') {
        // If changing to internal, set employee_id to null (internal files belong to organization)
        updateData.employee_id = null;
      }

      console.log('Updating file with data:', updateData);
      await onUpdate(file.id, updateData);
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Error updating file:', error);
    }
  };

  if (!file) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[600px] h-[600px] max-w-[90vw] max-h-[90vh] p-0 flex flex-col">
        <DialogHeader className="flex-shrink-0 border-b border-border bg-gradient-to-r from-accent/80 to-primary/5 px-6 pb-4 pt-6 dark:from-accent/20 dark:to-primary/10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Edit className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold">
                {file.source_type === 'link' ? 'Edit Link' : 'Edit File'}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-1">
                {file.source_type === 'link' 
                  ? 'Update link information and metadata'
                  : 'Update file information and metadata'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
          <div 
            className="flex-1 overflow-y-auto px-6 py-6" 
            style={{ 
              scrollbarWidth: 'thin',
              scrollBehavior: 'smooth',
              scrollbarColor: '#d1d5db transparent'
            }}
          >
            <div className="space-y-6">
              {/* Link URL Section (only for links) */}
              {file.source_type === 'link' && (
                <>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label htmlFor="link-url" className="text-sm font-medium text-foreground">
                        Link URL <span className="text-destructive">*</span>
                      </label>
                      <div className="space-y-2">
                        <Input
                          id="link-url"
                          type="url"
                          value={linkUrl}
                          onChange={(e) => handleLinkChange(e.target.value)}
                          placeholder="https://docs.google.com/document/d/..."
                          disabled={isUpdating || validatingLink}
                          className="w-full"
                        />
                        {validatingLink && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Validating and extracting metadata...</span>
                          </div>
                        )}
                        {linkMetadata && (
                          <div className="rounded-lg border border-border bg-success-muted p-3">
                            <div className="flex items-start gap-3">
                              <LinkIcon className="mt-0.5 h-4 w-4 text-success-foreground" />
                              <div className="flex-1">
                                <div className="text-sm font-medium text-foreground">
                                  {linkMetadata.title || 'Link'}
                                </div>
                                {linkMetadata.description && (
                                  <div className="mt-1 text-xs text-muted-foreground">
                                    {linkMetadata.description}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <Separator />
                </>
              )}

              {/* File Information Section */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="file_name" className="text-sm font-medium text-foreground">
                      {file.source_type === 'link' ? 'Link Name' : 'File Name'} <span className="text-destructive">*</span>
                    </label>
                    <Input
                      id="file_name"
                      {...register('file_name')}
                      placeholder={file.source_type === 'link' ? 'Enter link name' : 'Enter file name'}
                      className={errors.file_name ? 'border-destructive' : ''}
                    />
                    {errors.file_name && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.file_name.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="file_category" className="text-sm font-medium text-foreground">
                      Category
                    </label>
                    <Select
                      value={watch('file_category')}
                      onValueChange={(value) => setValue('file_category', value as any)}
                    >
                      <SelectTrigger id="file_category" className={errors.file_category ? 'border-destructive' : ''}>
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
                    {errors.file_category && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.file_category.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              {!lockVisibility && (
              <>
              {/* Visibility Section */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="visibility" className="text-sm font-medium text-foreground">
                    Visibility
                  </label>
                  <Select
                    value={watch('visibility')}
                    onValueChange={(value) => setValue('visibility', value as any)}
                  >
                    <SelectTrigger id="visibility" className={errors.visibility ? 'border-destructive' : ''}>
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
                  {errors.visibility && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.visibility.message}
                    </p>
                  )}
                </div>
              </div>

              <Separator />
              </>
              )}

              {/* Description Section */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="description" className="text-sm font-medium text-foreground">
                    Description <span className="text-muted-foreground text-xs font-normal">(optional)</span>
                  </label>
                  <Textarea
                    id="description"
                    {...register('description')}
                    placeholder="Enter description"
                    className="min-h-[100px] resize-none"
                  />
                  {errors.description && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.description.message}
                    </p>
                  )}
                </div>
              </div>

              <Separator />

              {/* Expiry Date Section */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="expires_at" className="text-sm font-medium text-foreground">
                    Expiry Date <span className="text-muted-foreground text-xs font-normal">(optional)</span>
                  </label>
                  <Input
                    id="expires_at"
                    type="date"
                    {...register('expires_at')}
                  />
                  {errors.expires_at && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.expires_at.message}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 pb-6 pt-4 flex-shrink-0 border-t bg-muted/30">
            <div className="flex items-center justify-end gap-3">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose} 
                disabled={isUpdating}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isUpdating}
                className="min-w-[120px]"
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  file.source_type === 'link' ? 'Update Link' : 'Update File'
                )}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
