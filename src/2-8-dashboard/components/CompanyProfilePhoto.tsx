
import React, { useState, useCallback } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/shared/components/ui/avatar';
import { Camera, Upload, X, Loader2 } from 'lucide-react';
import { supabase } from '@/shared/lib/supabaseClient';
import { storageUploadOptions } from '@/shared/lib/storageCacheControl';
import { optimizePublicStorageImageUrl } from '@/shared/lib/storageDisplayUrl';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { toast } from 'sonner';

interface CompanyProfilePhotoProps {
  companyName: string;
  logoUrl?: string | null;
  onLogoUpdate: (logoUrl: string | null) => void;
}

export const CompanyProfilePhoto = ({ 
  companyName, 
  logoUrl, 
  onLogoUpdate 
}: CompanyProfilePhotoProps) => {
  const { organizationId } = useCurrentOrg();
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getPublicUrl = (path: string) => {
    const { data } = supabase.storage
      .from('company-profiles')
      .getPublicUrl(path);
    return data.publicUrl;
  };

  const uploadPhoto = useCallback(async (file: File) => {
    if (!organizationId) {
      toast.error('Organization ID not found');
      return;
    }

    setUploading(true);
    try {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        throw new Error('Please select an image file');
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        throw new Error('File size must be less than 5MB');
      }

      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${organizationId}-${Date.now()}.${fileExt}`;

      // Delete existing logo if exists
      if (logoUrl) {
        const oldPath = logoUrl.split('/').pop();
        if (oldPath) {
          await supabase.storage
            .from('company-profiles')
            .remove([oldPath]);
        }
      }

      // Upload new file
      const { data, error } = await supabase.storage
        .from('company-profiles')
        .upload(fileName, file, storageUploadOptions({ upsert: false, contentType: file.type }));

      if (error) {
        throw error;
      }

      const publicUrl = getPublicUrl(data.path);

      // Update organization record
      const { error: updateError } = await supabase
        .from('organizations')
        .update({ 
          logo_url: publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', organizationId);

      if (updateError) {
        throw updateError;
      }

      onLogoUpdate(publicUrl);
      toast.success('Company logo updated successfully');

    } catch (err: any) {
      console.error('Upload error:', err);
      toast.error(err.message || 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  }, [organizationId, logoUrl, onLogoUpdate]);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadPhoto(file);
    }
    // Reset input value
    event.target.value = '';
  }, [uploadPhoto]);

  const deletePhoto = useCallback(async () => {
    if (!organizationId || !logoUrl) {
      return;
    }

    setDeleting(true);
    try {
      // Extract filename from URL
      const filename = logoUrl.split('/').pop();
      if (filename) {
        // Delete from storage
        const { error: storageError } = await supabase.storage
          .from('company-profiles')
          .remove([filename]);

        if (storageError) {
          throw storageError;
        }
      }

      // Update organization record
      const { error: updateError } = await supabase
        .from('organizations')
        .update({ 
          logo_url: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', organizationId);

      if (updateError) {
        throw updateError;
      }

      onLogoUpdate(null);
      toast.success('Company logo removed successfully');

    } catch (err: any) {
      console.error('Delete error:', err);
      toast.error(err.message || 'Failed to delete photo');
    } finally {
      setDeleting(false);
    }
  }, [organizationId, logoUrl, onLogoUpdate]);

  return (
    <div className="relative inline-block flex-shrink-0">
      <div className="relative group">
        <Avatar className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 cursor-pointer">
          <AvatarImage
            src={optimizePublicStorageImageUrl(logoUrl, { width: 128, resize: "contain", quality: 80 }) ?? undefined}
            alt={`${companyName} logo`}
            className="object-cover"
          />
          <AvatarFallback className="text-lg sm:text-xl md:text-2xl font-bold bg-muted text-muted-foreground">
            {getInitials(companyName)}
          </AvatarFallback>
        </Avatar>
        
        {/* Overlay with hover effect */}
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-300 rounded-full flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center space-x-2">
            {/* Upload Button */}
            <input
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              disabled={uploading || deleting}
              className="hidden"
              id="company-logo-upload"
            />
            <label htmlFor="company-logo-upload">
              <Button 
                variant="secondary" 
                size="sm"
                disabled={uploading || deleting}
                className="h-8 w-8 cursor-pointer bg-card/90 p-0 shadow-lg hover:bg-card"
                asChild
              >
                <span>
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                </span>
              </Button>
            </label>

            {/* Remove Button */}
            {logoUrl && (
              <Button 
                variant="secondary" 
                size="sm"
                onClick={deletePhoto}
                disabled={uploading || deleting}
                className="h-8 w-8 p-0 bg-card/90 hover:bg-card shadow-lg text-destructive hover:text-destructive/90"
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <X className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
      
      <div className="mt-2 text-center">
        <p className="text-xs text-muted-foreground">
          JPG, PNG up to 5MB
        </p>
      </div>
    </div>
  );
};
