import React, { useState, useCallback } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/shared/components/ui/avatar';
import { Upload, X, Loader2 } from 'lucide-react';
import { supabase } from '@/shared/lib/supabaseClient';
import { toast } from 'sonner';
import { getInitials } from '@/2-1-employees/hooks/photoUtils';

interface EmployeeProfilePhotoProps {
  employeeName: string;
  employeeId?: string;
  photoUrl?: string | null;
  onPhotoUpdate: (photoUrl: string | null) => void;
  size?: 'sm' | 'md' | 'lg';
}

export const EmployeeProfilePhoto = ({ 
  employeeName, 
  employeeId,
  photoUrl, 
  onPhotoUpdate,
  size = 'md'
}: EmployeeProfilePhotoProps) => {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-20 h-20', 
    lg: 'w-32 h-32'
  };

  const getPublicUrl = (path: string) => {
    const { data } = supabase.storage
      .from('employee-profiles')
      .getPublicUrl(path);
    return data.publicUrl;
  };

  const uploadPhoto = useCallback(async (file: File) => {
    if (!employeeId) {
      toast.error('Employee ID not found');
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

      // Get current user ID for folder structure
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Generate unique filename with user folder structure
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${employeeId}-${Date.now()}.${fileExt}`;

      // Delete existing photo if exists
      if (photoUrl) {
        const oldPath = photoUrl.split('/employee-profiles/').pop();
        if (oldPath) {
          await supabase.storage
            .from('employee-profiles')
            .remove([oldPath]);
        }
      }

      // Upload new file
      const { data, error } = await supabase.storage
        .from('employee-profiles')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        throw error;
      }

      const publicUrl = getPublicUrl(data.path);

      // Update employee record
      const { error: updateError } = await (supabase
        .from('employees') as any)
        .update({ 
          profile_photo_url: publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', employeeId);

      if (updateError) {
        throw updateError;
      }

      onPhotoUpdate(publicUrl);
      toast.success('Profile photo updated successfully');

    } catch (err: any) {
      console.error('Upload error:', err);
      toast.error(err.message || 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  }, [employeeId, photoUrl, onPhotoUpdate]);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadPhoto(file);
    }
    // Reset input value
    event.target.value = '';
  }, [uploadPhoto]);

  const deletePhoto = useCallback(async () => {
    if (!employeeId || !photoUrl) {
      return;
    }

    setDeleting(true);
    try {
      // Extract filename from URL
      const filename = photoUrl.split('/employee-profiles/').pop();
      if (filename) {
        // Delete from storage
        const { error: storageError } = await supabase.storage
          .from('employee-profiles')
          .remove([filename]);

        if (storageError) {
          throw storageError;
        }
      }

      // Update employee record
      const { error: updateError } = await (supabase
        .from('employees') as any)
        .update({ 
          profile_photo_url: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', employeeId);

      if (updateError) {
        throw updateError;
      }

      onPhotoUpdate(null);
      toast.success('Profile photo removed successfully');

    } catch (err: any) {
      console.error('Delete error:', err);
      toast.error(err.message || 'Failed to delete photo');
    } finally {
      setDeleting(false);
    }
  }, [employeeId, photoUrl, onPhotoUpdate]);

  return (
    <div className="relative inline-block">
      <div className="relative group">
        <Avatar className={`${sizeClasses[size]} cursor-pointer`}>
          <AvatarImage 
            src={photoUrl || undefined} 
            alt={`${employeeName} profile photo`}
            className="object-cover"
          />
          <AvatarFallback className="text-lg font-semibold bg-secondary text-secondary-foreground">
            {getInitials(employeeName)}
          </AvatarFallback>
        </Avatar>
        
        {/* Overlay with hover effect */}
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-300 rounded-full flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center space-x-1">
            {/* Upload Button */}
            <input
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              disabled={uploading || deleting}
              className="hidden"
              id="employee-photo-upload"
            />
            <label htmlFor="employee-photo-upload">
              <Button 
                variant="secondary" 
                size="sm"
                disabled={uploading || deleting}
                className="cursor-pointer h-6 w-6 p-0 bg-white/90 hover:bg-white shadow-lg"
                asChild
              >
                <span>
                  {uploading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Upload className="h-3 w-3" />
                  )}
                </span>
              </Button>
            </label>

            {/* Remove Button */}
            {photoUrl && (
              <Button 
                variant="secondary" 
                size="sm"
                onClick={deletePhoto}
                disabled={uploading || deleting}
                className="h-6 w-6 p-0 bg-white/90 hover:bg-white shadow-lg text-red-600 hover:text-red-700"
              >
                {deleting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <X className="h-3 w-3" />
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

