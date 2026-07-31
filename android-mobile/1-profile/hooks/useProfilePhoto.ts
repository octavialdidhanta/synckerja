import { useState } from 'react';
import { supabase } from '@/shared/lib/supabaseClient';
import { useToast } from '@/shared/hooks/use-toast';
import { useProfile } from '@/mobile-app/hooks/useProfile';

async function syncProfilePhotoUrl(userId: string, photoUrl: string | null) {
  const { error: employeeError } = await supabase
    .from('employees')
    .update({
      profile_photo_url: photoUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (employeeError) throw employeeError;

  const { error: detailsError } = await supabase.from('user_profile_details').upsert(
    {
      profile_id: userId,
      profile_photo_url: photoUrl,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'profile_id' },
  );

  if (detailsError) throw detailsError;

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      profile_photo_url: photoUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  // Non-fatal: header may still resolve photo from employees / user_profile_details.
  if (profileError) {
    console.warn('profiles.profile_photo_url update failed:', profileError);
  }
}

export const useProfilePhoto = () => {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();
  const { profile, refetch } = useProfile();

  const uploadPhoto = async (file: File) => {
    try {
      setUploading(true);

      if (!file.type.startsWith('image/')) {
        throw new Error('File harus berupa gambar');
      }

      if (file.size > 5 * 1024 * 1024) {
        throw new Error('Ukuran file maksimal 5MB');
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('User tidak ditemukan');

      if (profile?.photo_url) {
        await deletePhoto(false);
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('employee-profiles')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('employee-profiles').getPublicUrl(fileName);

      await syncProfilePhotoUrl(user.id, publicUrl);
      await refetch();

      toast({
        title: 'Berhasil',
        description: 'Foto profil berhasil diupload',
      });

      return publicUrl;
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
      throw error;
    } finally {
      setUploading(false);
    }
  };

  const deletePhoto = async (showToast = true) => {
    try {
      if (showToast) setDeleting(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('User tidak ditemukan');

      if (!profile?.photo_url) {
        if (showToast) {
          toast({
            title: 'Info',
            description: 'Tidak ada foto untuk dihapus',
          });
        }
        return;
      }

      const url = new URL(profile.photo_url);
      const filePath = url.pathname.split('/').slice(-2).join('/');

      const { error: deleteError } = await supabase.storage
        .from('employee-profiles')
        .remove([filePath]);

      if (deleteError) throw deleteError;

      await syncProfilePhotoUrl(user.id, null);
      await refetch();

      if (showToast) {
        toast({
          title: 'Berhasil',
          description: 'Foto profil berhasil dihapus',
        });
      }
    } catch (error: any) {
      if (showToast) {
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
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
    deleting,
  };
};
