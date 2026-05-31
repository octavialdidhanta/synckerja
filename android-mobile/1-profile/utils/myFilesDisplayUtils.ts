import type { AppLanguage } from '@/shared/i18n/translations';
import {
  formatFileSize,
  FILE_CATEGORIES,
  FILE_VISIBILITY,
  getFileExtension,
  ALLOWED_FILE_TYPES,
  type FileCategory,
  type CompanyFile,
} from '@/2-8-dashboard/utils/fileTypes';

type TranslateFn = (key: string, fallback?: string) => string;

export function formatMyFileUploadDate(value: string | undefined, language: AppLanguage): string {
  if (!value?.trim()) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.trim();
  return date.toLocaleDateString(language === 'id' ? 'id-ID' : 'en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function formatMyFileDetailDate(value: string | undefined, language: AppLanguage): string {
  if (!value?.trim()) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.trim();
  return date.toLocaleDateString(language === 'id' ? 'id-ID' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function getFileTypeLabel(file: CompanyFile, t: TranslateFn): string {
  if (file.source_type === 'link') {
    return t('profile.myFiles.externalLinkType', 'External Link');
  }

  const ext = getFileExtension(file.original_name || file.file_name);
  if (ext) return ext;

  const fromMime = ALLOWED_FILE_TYPES[file.mime_type as keyof typeof ALLOWED_FILE_TYPES];
  if (fromMime) return fromMime;

  return t('profile.myFiles.unknownFileType', 'File');
}

export function getVisibilityLabel(
  visibility: keyof typeof FILE_VISIBILITY,
  t: TranslateFn,
): string {
  if (visibility === 'privat') {
    return t('profile.myFiles.visibilityPrivate', 'Private');
  }
  return t('profile.myFiles.visibilityInternal', 'Internal');
}

export function getFileCategoryLabel(
  category: FileCategory,
  t: TranslateFn,
): string {
  const keyMap: Record<FileCategory, string> = {
    dokumen: 'profile.myFiles.categoryDocuments',
    gambar: 'profile.myFiles.categoryImages',
    pdf: 'profile.myFiles.categoryPdf',
    lainnya: 'profile.myFiles.categoryOthers',
  };
  const fallbacks: Record<FileCategory, string> = {
    dokumen: FILE_CATEGORIES.dokumen,
    gambar: FILE_CATEGORIES.gambar,
    pdf: FILE_CATEGORIES.pdf,
    lainnya: FILE_CATEGORIES.lainnya,
  };
  return t(keyMap[category], fallbacks[category]);
}

export { formatFileSize };
