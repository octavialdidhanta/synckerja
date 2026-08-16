import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

async function photoToFile(
  photo: { webPath?: string; format?: string },
  prefix: string,
): Promise<File | null> {
  if (!photo.webPath) return null;
  const response = await fetch(photo.webPath);
  const blob = await response.blob();
  const rawType = (blob.type || photo.format || 'image/jpeg').toLowerCase();
  const mimeType =
    rawType === 'image/jpg' || rawType === 'jpg' || rawType === 'jpeg'
      ? 'image/jpeg'
      : rawType === 'png' || rawType === 'image/png'
        ? 'image/png'
        : rawType === 'webp' || rawType === 'image/webp'
          ? 'image/webp'
          : rawType.startsWith('image/')
            ? rawType
            : 'image/jpeg';
  const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  return new File([blob], `${prefix}_${Date.now()}.${extension}`, {
    type: mimeType,
  });
}

export async function pickStoryboardNativePhoto(
  source: 'camera' | 'gallery',
): Promise<File[]> {
  if (!Capacitor.isNativePlatform()) return [];
  const photo = await Camera.getPhoto({
    source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
    resultType: CameraResultType.Uri,
    quality: 85,
    saveToGallery: false,
  });
  const file = await photoToFile(photo, 'storyboard');
  return file ? [file] : [];
}
