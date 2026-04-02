
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Separator } from '@/shared/components/ui/separator';
import { Eye, Download, FileText, Link as LinkIcon, ExternalLink } from 'lucide-react';
import { CompanyFile, isImageFile, isPdfFile, FILE_CATEGORIES, FILE_VISIBILITY, formatFileSize } from '@/2-8-dashboard/utils/fileTypes';
import { supabase } from '@/shared/lib/supabaseClient';
import { useShowToast } from '@/shared/hooks/useShowToast';
import { format } from 'date-fns';
import { getLinkIcon } from '@/2-8-files/utils/linkUtils';

interface FilePreviewModalProps {
  file: CompanyFile | null;
  isOpen: boolean;
  onClose: () => void;
  onDownload: (file: CompanyFile) => void;
}

export const FilePreviewModal = ({ file, isOpen, onClose, onDownload }: FilePreviewModalProps) => {
  const showToast = useShowToast();
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    if (file && isOpen) {
      if (file.source_type === 'link') {
        // For links, use the link URL directly
        setPreviewUrl(file.file_path);
        setIsLoading(false);
      } else {
        generatePreviewUrl();
      }
    }
    return () => {
      if (previewUrl && file?.source_type === 'upload') {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [file, isOpen]);

  const generatePreviewUrl = async () => {
    if (!file || file.source_type === 'link') return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.storage
        .from('company-files')
        .createSignedUrl(file.file_path, 3600); // 1 hour expiry

      if (error) throw error;

      setPreviewUrl(data.signedUrl);
    } catch (error: any) {
      console.error('Error generating preview URL:', error);
      showToast({
        title: 'Error',
        description: 'Failed to generate preview URL',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderPreview = () => {
    if (!file) {
      return (
        <div className="text-center py-8">
          <FileText className="h-12 w-12 text-muted-foreground/35 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Preview not available</p>
        </div>
      );
    }

    // Render link preview
    if (file.source_type === 'link') {
      return (
        <div className="text-center py-8 space-y-4">
          <div className="flex flex-col items-center gap-4">
            {/* Thumbnail */}
            {file.link_thumbnail_url ? (
              <img
                src={file.link_thumbnail_url}
                alt={file.link_title || file.file_name}
                className="mx-auto max-h-[200px] max-w-full rounded border border-border object-contain"
                onError={(e) => {
                  // Fallback to icon if thumbnail fails to load
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <div className="text-6xl mb-2">{getLinkIcon(file.file_path)}</div>
            )}
            
            {/* Link Info */}
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-foreground">
                {file.link_title || file.file_name}
              </h3>
              {file.link_description && (
                <p className="text-sm text-muted-foreground max-w-md">{file.link_description}</p>
              )}
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <LinkIcon className="w-4 h-4" />
                <span className="truncate max-w-md">{file.file_path}</span>
              </div>
            </div>

            {/* Open Link Button */}
            <Button
              onClick={() => window.open(file.file_path, '_blank')}
              className="mt-4"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open Link
            </Button>
          </div>
        </div>
      );
    }

    // Render uploaded file preview
    if (!previewUrl) {
      return (
        <div className="text-center py-8">
          <FileText className="h-12 w-12 text-muted-foreground/35 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Preview not available</p>
        </div>
      );
    }

    if (isImageFile(file.mime_type)) {
      return (
        <img
          src={previewUrl}
          alt={file.file_name}
          className="max-w-full max-h-[200px] object-contain mx-auto rounded"
        />
      );
    }

    if (isPdfFile(file.mime_type)) {
      return (
        <iframe
          src={previewUrl}
          className="w-full h-[200px] border-0 rounded"
          title={file.file_name}
        />
      );
    }

    return (
      <div className="text-center py-8">
        <FileText className="h-12 w-12 text-muted-foreground/35 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground mb-3">Preview not available for this file type</p>
        <Button 
          onClick={() => file && onDownload(file)} 
          size="sm"
          variant="outline"
        >
          <Download className="h-4 w-4 mr-2" />
          Download to View
        </Button>
      </div>
    );
  };

  if (!file) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[600px] h-[600px] max-w-[90vw] max-h-[90vh] p-0 flex flex-col" hideCloseButton>
        <DialogHeader className="flex-shrink-0 border-b border-border bg-gradient-to-r from-accent/80 to-primary/5 px-6 pb-4 pt-6 dark:from-accent/20 dark:to-primary/10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Eye className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-xl font-semibold">File Details</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-1">
                View file information and preview
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        <div 
          className="flex-1 overflow-y-auto px-6 py-6" 
          style={{ 
            scrollbarWidth: 'thin',
            scrollBehavior: 'smooth',
            scrollbarColor: 'hsl(var(--border)) transparent'
          }}
        >
          <div className="space-y-6">
            {/* Preview Section */}
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Preview</label>
                <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-border bg-muted/40 p-4">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    </div>
                  ) : (
                    renderPreview()
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* Basic Information Section */}
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">File Information</label>
                <div className="space-y-3 rounded-lg border border-border bg-card p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">File Name</p>
                      <p className="text-sm font-medium text-foreground">{file.file_name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Original Name</p>
                      <p className="text-sm font-medium text-foreground">{file.original_name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Size</p>
                      <p className="text-sm font-medium text-foreground">
                        {file.source_type === 'link' ? '—' : formatFileSize(file.file_size || 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Category</p>
                      <p className="text-sm font-medium text-foreground">{FILE_CATEGORIES[file.file_category]}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Visibility</p>
                      <p className="text-sm font-medium text-foreground">{FILE_VISIBILITY[file.visibility]}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Upload Date</p>
                      <p className="text-sm font-medium text-foreground">
                        {format(new Date(file.created_at), 'MMM dd, yyyy')}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Owner</p>
                      <p className="text-sm font-medium text-foreground">{file.owner_name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Type</p>
                      <p className="text-sm font-medium text-foreground">
                        {file.source_type === 'link' ? 'External Link' : file.mime_type}
                      </p>
                    </div>
                    {file.source_type === 'link' && file.link_modified_at && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Last Modified</p>
                        <p className="text-sm font-medium text-foreground">
                          {format(new Date(file.link_modified_at), 'MMM dd, yyyy')}
                        </p>
                      </div>
                    )}
                    {file.source_type === 'link' && file.link_owner && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Document Owner</p>
                        <p className="text-sm font-medium text-foreground">{file.link_owner}</p>
                      </div>
                    )}
                  </div>
                  {file.description && (
                    <div className="pt-3 border-t">
                      <p className="text-xs text-muted-foreground mb-1">Description</p>
                      <p className="text-sm text-foreground">{file.description}</p>
                    </div>
                  )}
                  {file.source_type === 'link' && file.link_description && (
                    <div className="pt-3 border-t">
                      <p className="text-xs text-muted-foreground mb-1">Link Description</p>
                      <p className="text-sm text-foreground">{file.link_description}</p>
                    </div>
                  )}
                </div>
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
            >
              Close
            </Button>
            {file.source_type === 'link' ? (
              <Button
                onClick={() => window.open(file.file_path, '_blank')}
                className="min-w-[120px]"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Link
              </Button>
            ) : (
              <Button
                onClick={() => onDownload(file)}
                className="min-w-[120px]"
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
