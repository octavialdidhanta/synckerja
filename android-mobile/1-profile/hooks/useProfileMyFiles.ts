import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/shared/lib/supabaseClient';
import { logger } from '@/shared/lib/logger';
import type { CompanyFile } from '@/2-8-dashboard/utils/fileTypes';

export type ProfileMyFile = CompanyFile;

const MY_FILES_SELECT =
  'id, organization_id, file_name, original_name, file_path, file_size, mime_type, file_category, description, visibility, owner_id, owner_name, employee_id, expires_at, source_type, link_title, link_description, link_modified_at, link_owner, link_thumbnail_url, created_at, updated_at';

async function fetchMyPrivateFiles(
  organizationId: string,
  userId: string,
  employeeId: string | null,
): Promise<ProfileMyFile[]> {
  try {
    const { data, error } = await supabase
      .from('company_files')
      .select(MY_FILES_SELECT)
      .eq('organization_id', organizationId)
      .eq('visibility', 'privat')
      .order('created_at', { ascending: false });

    if (error) {
      logger.warn('Error fetching private files:', error);
      return [];
    }

    return (data ?? []).filter(
      (file) =>
        file.owner_id === userId || (employeeId != null && file.employee_id === employeeId),
    ) as ProfileMyFile[];
  } catch (err) {
    logger.warn('Failed to fetch private files:', err);
    return [];
  }
}

interface UseProfileMyFilesOptions {
  organizationId: string | null;
  userId: string | null;
  employeeId: string | null;
  enabled: boolean;
}

export function useProfileMyFiles({
  organizationId,
  userId,
  employeeId,
  enabled,
}: UseProfileMyFilesOptions) {
  const [files, setFiles] = useState<ProfileMyFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const cancelledRef = useRef(false);

  const fetchData = useCallback(async () => {
    if (!organizationId || !userId) {
      setFiles([]);
      return;
    }

    cancelledRef.current = false;
    setLoading(true);
    setError(null);

    try {
      const result = await fetchMyPrivateFiles(organizationId, userId, employeeId);

      if (cancelledRef.current) return;

      setFiles(result);
    } catch (err) {
      if (!cancelledRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch files');
      }
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  }, [organizationId, userId, employeeId]);

  useEffect(() => {
    if (!enabled) {
      cancelledRef.current = true;
      return;
    }

    void fetchData();

    return () => {
      cancelledRef.current = true;
    };
  }, [enabled, fetchData]);

  const deleteFile = useCallback(
    async (fileId: string) => {
      const file = files.find((f) => f.id === fileId);
      if (!file) throw new Error('File not found');

      setIsDeleting(true);
      try {
        if (file.source_type === 'upload') {
          const { error: storageError } = await supabase.storage
            .from('company-files')
            .remove([file.file_path]);

          if (storageError) {
            logger.warn('Storage delete error:', storageError);
          }
        }

        const { error: dbError } = await supabase.from('company_files').delete().eq('id', fileId);

        if (dbError) throw dbError;

        await fetchData();
      } finally {
        setIsDeleting(false);
      }
    },
    [files, fetchData],
  );

  const updateFile = useCallback(
    async (id: string, metadata: Record<string, unknown>) => {
      setIsUpdating(true);
      try {
        const { error: dbError } = await supabase
          .from('company_files')
          .update({
            ...metadata,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);

        if (dbError) throw dbError;

        await fetchData();
      } finally {
        setIsUpdating(false);
      }
    },
    [fetchData],
  );

  const downloadFile = useCallback(async (file: ProfileMyFile) => {
    if (file.source_type === 'link') {
      window.open(file.file_path, '_blank', 'noopener,noreferrer');
      return;
    }

    const { data, error: downloadError } = await supabase.storage
      .from('company-files')
      .download(file.file_path);

    if (downloadError) throw downloadError;

    const url = URL.createObjectURL(data);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = file.original_name;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, []);

  return {
    files,
    loading,
    error,
    isDeleting,
    isUpdating,
    refetch: fetchData,
    deleteFile,
    updateFile,
    downloadFile,
  };
}
