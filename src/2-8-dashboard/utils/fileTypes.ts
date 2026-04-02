export const FILE_CATEGORIES = {
  dokumen: 'Documents',
  gambar: 'Images', 
  pdf: 'PDF',
  lainnya: 'Others'
} as const;

export const FILE_VISIBILITY = {
  internal: 'Internal',
  privat: 'Private'
} as const;

export const ALLOWED_FILE_TYPES = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
  'image/jpeg': 'JPG',
  'image/jpg': 'JPG', 
  'image/png': 'PNG',
  'image/webp': 'WEBP'
} as const;

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export type FileCategory = keyof typeof FILE_CATEGORIES;
export type FileVisibility = keyof typeof FILE_VISIBILITY;

export type FileSourceType = 'upload' | 'link';

export interface CompanyFile {
  id: string;
  organization_id: string;
  file_name: string;
  original_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string;
  file_category: FileCategory;
  description?: string;
  visibility: FileVisibility;
  owner_id: string;
  owner_name: string;
  employee_id?: string | null;
  expires_at?: string;
  source_type: FileSourceType;
  // Link metadata (only for source_type = 'link')
  link_title?: string | null;
  link_description?: string | null;
  link_modified_at?: string | null;
  link_owner?: string | null;
  link_thumbnail_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FileFilters {
  jenisFile: FileCategory[];
  status: FileVisibility[];
  rentangTanggal: {
    start: Date | null;
    end: Date | null;
  };
}

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const getFileExtension = (filename: string): string => {
  return filename.split('.').pop()?.toUpperCase() || '';
};

export const isImageFile = (mimeType: string): boolean => {
  return mimeType.startsWith('image/');
};

export const isPdfFile = (mimeType: string): boolean => {
  return mimeType === 'application/pdf';
};
