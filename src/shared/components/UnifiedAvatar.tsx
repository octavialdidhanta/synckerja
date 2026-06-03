
import React, { useState, useCallback, memo } from 'react';
import { resolveProfilePhotoDisplayUrl } from '@/shared/lib/profilePhotoStorage';
import { Avatar, AvatarImage, AvatarFallback } from '@/shared/components/ui/avatar';
// import { getPhotoUrl, getInitials } from '@/utils/photoUtils';
// import { PhotoViewModal } from './PhotoViewModal';

// Simple implementations
const getPhotoUrl = (photoUrl: string) => {
  // Simple implementation - return as is for now
  return photoUrl;
};

const getInitials = (name: string) => {
  if (!name) return 'U';
  const words = name.trim().split(' ');
  if (words.length === 1) {
    return words[0].charAt(0).toUpperCase();
  }
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
};

const PhotoViewModal = ({ isOpen, onClose, photoUrl, employeeName }: any) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white p-4 rounded-lg max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">{employeeName}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">×</button>
        </div>
        {photoUrl && (
          <img src={photoUrl} alt={employeeName} className="w-full h-auto rounded" />
        )}
      </div>
    </div>
  );
};

interface UnifiedAvatarProps {
  photoUrl?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'md-lg' | 'lg' | 'xl';
  className?: string;
  clickable?: boolean;
}

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm', 
  'md-lg': 'h-12 w-12 text-sm',
  lg: 'h-16 w-16 text-lg',
  xl: 'h-24 w-24 text-xl'
};

const isDev = import.meta.env.DEV;
const shouldLog = isDev && Math.random() < 0.02; // Only log 2% in dev

export const UnifiedAvatar: React.FC<UnifiedAvatarProps> = memo(({
  photoUrl,
  name,
  size = 'md',
  className = '',
  clickable = true
}) => {
  const [showPhotoModal, setShowPhotoModal] = useState(false);

  const handleCloseModal = useCallback(() => {
    setShowPhotoModal(false);
  }, []);
  
  const fullPhotoUrl = React.useMemo(() => {
    if (!photoUrl) return null;
    const resolved = resolveProfilePhotoDisplayUrl(photoUrl) ?? getPhotoUrl(photoUrl);
    if (shouldLog) console.log('🔄 Resolved photo URL:', resolved);
    return resolved;
  }, [photoUrl]);
  
  const handleAvatarClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (clickable && fullPhotoUrl) {
      setShowPhotoModal(true);
    }
  }, [clickable, fullPhotoUrl]);

  const handleImageLoad = useCallback(() => {
    if (shouldLog) console.log('✅ Avatar image loaded successfully:', fullPhotoUrl);
  }, [fullPhotoUrl]);

  const handleImageError = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    console.error('❌ Avatar image failed to load:', fullPhotoUrl, e);
  }, [fullPhotoUrl]);

  return (
    <>
      <Avatar 
        className={`${sizeClasses[size]} ${className} ${clickable && fullPhotoUrl ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
        onClick={handleAvatarClick}
      >
        {fullPhotoUrl && (
          <AvatarImage 
            src={fullPhotoUrl} 
            alt={name}
            className="object-cover"
            key={fullPhotoUrl} // Only re-render when URL actually changes
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
        )}
        <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
          {getInitials(name)}
        </AvatarFallback>
      </Avatar>

      <PhotoViewModal
        isOpen={showPhotoModal}
        onClose={handleCloseModal}
        photoUrl={fullPhotoUrl}
        employeeName={name}
      />
    </>
  );
});
