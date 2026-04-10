import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/features/ui/use-toast';
import { useProfile } from '@/mobile/hooks/useProfile';

export const useProfilePhoto = () => {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();
  const { profile, refetch } = useProfile();

  const uploadPhoto = async (file: File) => {
    try {
      setUploading(true);

      // Validate file type
      if (!file.type.startsWith('image/')) {
        throw new Error('File harus berupa gambar');
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('Ukuran file maksimal 5MB');
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User tidak ditemukan');

      // Delete existing photo if any
      if (profile?.photo_url) {
        await deletePhoto(false); // Don't show success toast for deletion during upload
      }

      // Create unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('employee-profiles')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('employee-profiles')
        .getPublicUrl(fileName);

      // Update employee table
      const { error: updateError } = await supabase
        .from('employees')
        .update({ photo_url: publicUrl })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      // Refresh profile data
      await refetch();

      toast({
        title: "Berhasil",
        description: "Foto profil berhasil diupload"
      });

      return publicUrl;
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
      throw error;
    } finally {
      setUploading(false);
    }
  };

  const deletePhoto = async (showToast = true) => {
    try {
      if (showToast) setDeleting(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User tidak ditemukan');

      if (!profile?.photo_url) {
        if (showToast) {
          toast({
            title: "Info",
            description: "Tidak ada foto untuk dihapus"
          });
        }
        return;
      }

      // Extract file path from URL
      const url = new URL(profile.photo_url);
      const filePath = url.pathname.split('/').slice(-2).join('/'); // user_id/filename

      // Delete from storage
      const { error: deleteError } = await supabase.storage
        .from('employee-profiles')
        .remove([filePath]);

      if (deleteError) throw deleteError;

      // Update employee table
      const { error: updateError } = await supabase
        .from('employees')
        .update({ photo_url: null })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      // Refresh profile data
      await refetch();

      if (showToast) {
        toast({
          title: "Berhasil",
          description: "Foto profil berhasil dihapus"
        });
      }
    } catch (error: any) {
      if (showToast) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive"
        });
      }
      throw error;
    } finally {
      if (showToast) setDeleting(false);
    }
  };

  return {
    uploadPhoto,
    deletePhoto,
    uploading,
    deleting
  };
};