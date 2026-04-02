
import React, { useState, useEffect } from 'react';
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
import { Upload, X, FileText, AlertCircle, Link as LinkIcon, Loader2 } from 'lucide-react';
import { FILE_CATEGORIES, FILE_VISIBILITY, FileSourceType } from '@/2-8-dashboard/utils/fileTypes';
import { validateFile } from '@/2-8-dashboard/utils/fileValidation';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useShowToast } from '@/shared/hooks/useShowToast';
import { useQueryClient } from '@tanstack/react-query';
import { isValidUrl, verifyUrlAccess, extractLinkMetadata, getLinkIcon } from '@/2-8-files/utils/linkUtils';

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FileUploadModal = ({ isOpen, onClose }: FileUploadModalProps) => {
  const [sourceType, setSourceType] = useState<FileSourceType>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkMetadata, setLinkMetadata] = useState<any>(null);
  const [validatingLink, setValidatingLink] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    file_name: '',
    file_category: 'dokumen' as keyof typeof FILE_CATEGORIES,
    visibility: 'internal' as keyof typeof FILE_VISIBILITY,
    description: ''
  });

  const { organizationId } = useCurrentOrg();
  const showToast = useShowToast();
  const queryClient = useQueryClient();

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      const validation = validateFile(selectedFile);
      if (!validation.isValid) {
        showToast({
          title: 'Error',
          description: validation.error,
          variant: 'destructive'
        });
        return;
      }
      setFile(selectedFile);
      setFormData(prev => ({
        ...prev,
        file_name: selectedFile.name.split('.')[0]
      }));
    }
  };

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
    setFormData({
      file_name: '',
      file_category: 'dokumen',
      visibility: 'internal',
      description: ''
    });
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
      let employeeId: string | null = null;
      if (formData.visibility === 'privat') {
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[600px] h-[600px] max-w-[90vw] max-h-[90vh] p-0 flex flex-col">
        <DialogHeader className="flex-shrink-0 border-b border-border bg-gradient-to-r from-accent/80 to-primary/5 px-6 pb-4 pt-6 dark:from-accent/20 dark:to-primary/10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Upload className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold">
                {sourceType === 'upload' ? 'Upload File' : 'Add Link'}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-1">
                {sourceType === 'upload' 
                  ? 'Upload and manage company files and documents'
                  : 'Add external links (Google Docs, Dropbox, etc.)'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div 
          className="flex-1 overflow-y-auto px-6 py-6" 
          style={{ 
            scrollbarWidth: 'thin',
            scrollBehavior: 'smooth',
            scrollbarColor: '#d1d5db transparent'
          }}
        >
          <div className="space-y-6">
            {/* Source Type Toggle */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Type <span className="text-destructive">*</span>
              </label>
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
                  className="flex-1"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload File
                </Button>
                <Button
                  type="button"
                  variant={sourceType === 'link' ? 'default' : 'outline'}
                  onClick={() => {
                    setSourceType('link');
                    setFile(null);
                  }}
                  disabled={uploading}
                  className="flex-1"
                >
                  <LinkIcon className="w-4 h-4 mr-2" />
                  Add Link
                </Button>
              </div>
            </div>

            <Separator />

            {/* File Selection Section */}
            {sourceType === 'upload' ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="file-upload" className="text-sm font-medium text-foreground">
                    Select File <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="file"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.webp"
                    disabled={uploading}
                  />
                  {!file ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('file-upload')?.click()}
                      disabled={uploading}
                      className="w-full h-24 border-2 border-dashed border-input hover:border-primary/50 transition-colors"
                    >
                      <div className="flex flex-col items-center gap-2">
                        {uploading ? (
                          <>
                            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            <span className="text-sm text-muted-foreground">Uploading...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-6 h-6 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              Click to upload file or drag and drop
                            </span>
                            <span className="text-xs text-muted-foreground">
                              PDF, DOC, XLS, PPT, Images up to 100MB
                            </span>
                          </>
                        )}
                      </div>
                    </Button>
                  ) : (
                    <div className="flex items-center justify-between rounded-lg border border-border bg-success-muted p-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-success-foreground" />
                        <span className="text-sm font-medium text-foreground">{file.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({(file.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={removeFile}
                        className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        disabled={uploading}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
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
                      disabled={uploading || validatingLink}
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
                          <div className="text-2xl">{getLinkIcon(linkUrl)}</div>
                          <div className="flex-1">
                            <div className="text-sm font-medium text-foreground">
                              {linkMetadata.title}
                            </div>
                            {linkMetadata.description && (
                              <div className="mt-1 text-xs text-muted-foreground">
                                {linkMetadata.description}
                              </div>
                            )}
                            {linkMetadata.owner && (
                              <div className="mt-1 text-xs text-muted-foreground/90">
                                Owner: {linkMetadata.owner}
                              </div>
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={removeLink}
                            className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            disabled={uploading}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                    {linkUrl && !linkMetadata && !validatingLink && (
                      <div className="flex items-center gap-2 text-sm text-warning-foreground">
                        <AlertCircle className="w-4 h-4" />
                        <span>Could not extract metadata. You can still save the link.</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <Separator />

            {/* File Information Section */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="file_name" className="text-sm font-medium text-foreground">
                    File Name <span className="text-destructive">*</span>
                  </label>
                  <Input
                    id="file_name"
                    value={formData.file_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, file_name: e.target.value }))}
                    placeholder="Enter file name"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="file_category" className="text-sm font-medium text-foreground">
                    Category
                  </label>
                  <Select
                    value={formData.file_category}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, file_category: value as any }))}
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
                </div>
              </div>
            </div>

            <Separator />

            {/* Visibility Section */}
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="visibility" className="text-sm font-medium text-foreground">
                  Visibility
                </label>
                <Select
                  value={formData.visibility}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, visibility: value as any }))}
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
              </div>
            </div>

            <Separator />

            {/* Description Section */}
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="description" className="text-sm font-medium text-foreground">
                  Description <span className="text-muted-foreground text-xs font-normal">(optional)</span>
                </label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Enter description"
                  className="min-h-[100px] resize-none"
                />
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
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={
                uploading || 
                !formData.file_name.trim() || 
                (sourceType === 'upload' && !file) ||
                (sourceType === 'link' && !linkUrl.trim())
              }
              className="min-w-[120px]"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {sourceType === 'upload' ? 'Uploading...' : 'Saving...'}
                </>
              ) : (
                sourceType === 'upload' ? 'Upload File' : 'Add Link'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
