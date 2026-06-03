import { resolveProfilePhotoDisplayUrl } from '@/shared/lib/profilePhotoStorage';

function baseUrl(): string {
  return String(import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '');
}

export const getPhotoUrl = (photoPath: string | null | undefined): string | null => {
  if (!photoPath) return null;

  const resolved = resolveProfilePhotoDisplayUrl(photoPath);
  if (resolved) return resolved;

  const root = baseUrl();
  if (!root) return null;

  if (photoPath.startsWith('employee-photo/')) {
    const encoded = photoPath
      .split('/')
      .map((seg) => encodeURIComponent(seg))
      .join('/');
    return `${root}/storage/v1/object/public/employee-documents/${encoded}`;
  }

  return null;
};

export const getInitials = (name: string): string => {
  if (!name) return 'U';
  return name
    .split(' ')
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
};
