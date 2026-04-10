import { useRef, type FC, type ChangeEvent } from 'react';
import { User, Camera, Trash2, Loader2 } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/mobile/components/ui/avatar';
import { Button } from '@/mobile/components/ui/button';
import { useProfilePhoto } from '@/mobile/hooks/useProfilePhoto';
import { ProfileData } from '@/mobile/hooks/useProfile';

interface ProfilePhotoUploadProps {
  profile: ProfileData;
}

export const ProfilePhotoUpload: FC<ProfilePhotoUploadProps> = ({ profile }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadPhoto, deletePhoto, uploading, deleting } = useProfilePhoto();

  const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await uploadPhoto(file);
      // Reset file input
      event.target.value = '';
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleDeletePhoto = async () => {
    await deletePhoto();
  };

  return (
    <div className="relative group">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
      
      <div className="relative">
        <Avatar className="w-20 h-20 mx-auto">
          {profile.photo_url ? (
            <AvatarImage 
              src={profile.photo_url} 
              alt={profile.full_name}
              className="object-cover"
            />
          ) : (
            <AvatarFallback className="bg-primary text-primary-foreground">
              <User className="h-10 w-10" />
            </AvatarFallback>
          )}
        </Avatar>
        
        {/* Upload/Delete buttons overlay */}
        <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-1">
          {profile.photo_url ? (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-white hover:bg-white/20"
                onClick={handleUploadClick}
                disabled={uploading || deleting}
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-white hover:bg-white/20"
                onClick={handleDeletePhoto}
                disabled={uploading || deleting}
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-white hover:bg-white/20"
              onClick={handleUploadClick}
              disabled={uploading || deleting}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};