
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useToast } from '@/shared/components/ui/use-toast';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { CompanyFile } from '@/2-8-dashboard/utils/fileTypes';
import { useCurrentUser } from '@/shared/hooks/useCurrentUser';
import { useCurrentEmployee } from '@/shared/hooks/useCurrentEmployee';

export const useCompanyFiles = () => {
  const { toast } = useToast();
  const { organizationId } = useCurrentOrg();
  const { user } = useCurrentUser();
  const { data: employee } = useCurrentEmployee();
  const queryClient = useQueryClient();

  // Fetch company files
  const {
    data: files = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['company-files', organizationId, user?.id, employee?.id],
    queryFn: async () => {
      if (!organizationId || !user) return [];

      // Get employee_id if exists
      let employeeId: string | null = null;
      if (employee) {
        employeeId = employee.id;
      }

      // Fetch all internal files (visible to all in organization) and private files
      // We use efficient query with OR filter and then filter in memory for security
      const internalFilesQuery = supabase
        .from('company_files')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('visibility', 'internal');

      const privateFilesQuery = supabase
        .from('company_files')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('visibility', 'privat');

      // Execute queries in parallel for better performance
      const [internalResult, privateResult] = await Promise.all([
        internalFilesQuery.order('created_at', { ascending: false }),
        privateFilesQuery.order('created_at', { ascending: false })
      ]);

      if (internalResult.error) {
        console.error('Error fetching internal files:', internalResult.error);
        throw internalResult.error;
      }

      if (privateResult.error) {
        console.error('Error fetching private files:', privateResult.error);
        throw privateResult.error;
      }

      // Filter private files based on ownership
      const allowedPrivateFiles = (privateResult.data || []).filter((file: any) => {
        // Private files: only show if owner_id matches OR employee_id matches
        return file.owner_id === user.id || (employeeId && file.employee_id === employeeId);
      });

      // Combine internal files (all visible) with filtered private files
      const allFiles = [
        ...(internalResult.data || []),
        ...allowedPrivateFiles
      ];

      // Sort by created_at descending
      allFiles.sort((a: any, b: any) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      return allFiles as CompanyFile[];
    },
    enabled: !!organizationId && !!user
  });

  // Delete file mutation
  const deleteFileMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const file = files.find(f => f.id === fileId);
      if (!file) throw new Error('File not found');

      // Only delete from storage if it's an uploaded file, not a link
      if (file.source_type === 'upload') {
        const { error: storageError } = await supabase.storage
          .from('company-files')
          .remove([file.file_path]);

        if (storageError) {
          console.error('Storage delete error:', storageError);
        }
      }

      // Delete from database (works for both uploads and links)
      const { error: dbError } = await supabase
        .from('company_files')
        .delete()
        .eq('id', fileId);

      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-files'] });
      toast({
        title: 'Success',
        description: 'File deleted successfully',
      });
    },
    onError: (error: any) => {
      console.error('Delete error:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete file',
        variant: 'destructive'
      });
    }
  });

  // Update file metadata mutation
  const updateFileMutation = useMutation({
    mutationFn: async ({ id, metadata }: { id: string; metadata: any }) => {
      console.log('Updating file in database:', { id, metadata });
      const { error, data } = await supabase
        .from('company_files')
        .update({
          ...metadata,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select();

      if (error) throw error;
      console.log('File updated successfully:', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-files'], exact: false });
      queryClient.refetchQueries({ queryKey: ['company-files'], exact: false });
      toast({
        title: 'Success',
        description: 'File updated successfully',
      });
    },
    onError: (error: any) => {
      console.error('Update error:', error);
      toast({
        title: 'Error',
        description: 'Failed to update file',
        variant: 'destructive'
      });
    }
  });

  // Download file function (only for uploaded files)
  const downloadFile = async (file: CompanyFile) => {
    try {
      // For links, open in new tab instead
      if (file.source_type === 'link') {
        window.open(file.file_path, '_blank');
        toast({
          title: 'Success',
          description: 'Link opened in new tab',
        });
        return;
      }

      // For uploaded files, download from storage
      const { data, error } = await supabase.storage
        .from('company-files')
        .download(file.file_path);

      if (error) throw error;

      // Create download link
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.original_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Success',
        description: 'File downloaded successfully',
      });
    } catch (error: any) {
      console.error('Download error:', error);
      toast({
        title: 'Error',
        description: 'Failed to download file',
        variant: 'destructive'
      });
    }
  };

  return {
    files,
    isLoading,
    error,
    deleteFile: deleteFileMutation.mutateAsync,
    updateFile: updateFileMutation.mutateAsync,
    downloadFile,
    isDeleting: deleteFileMutation.isPending,
    isUpdating: updateFileMutation.isPending
  };
};
