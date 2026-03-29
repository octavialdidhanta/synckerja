import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';

export interface EmployeeDocument {
  id: string;
  employee_id?: string;
  document_type: string;
  file_path: string;
  file_name: string;
  file_size?: number;
  mime_type?: string;
  uploaded_by?: string;
  is_verified?: boolean;
  verified_by?: string;
  verified_at?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export const useEmployeeDocuments = (employeeId: string) => {
  const queryClient = useQueryClient();

  const {
    data: documents = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['employee-documents', employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_documents')
        .select('*')
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as EmployeeDocument[];
    },
    enabled: !!employeeId,
  });

  const addDocument = useMutation({
    mutationFn: async (documentData: Omit<EmployeeDocument, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('employee_documents')
        .insert([documentData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-documents', employeeId] });
    },
  });

  const updateDocument = useMutation({
    mutationFn: async ({
      id,
      data: documentData,
    }: {
      id: string;
      data: Partial<Omit<EmployeeDocument, 'id' | 'created_at' | 'updated_at'>>;
    }) => {
      const { data, error } = await supabase
        .from('employee_documents')
        .update({ ...documentData, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-documents', employeeId] });
    },
  });

  const deleteDocument = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('employee_documents')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-documents', employeeId] });
    },
  });

  return {
    documents,
    isLoading,
    error,
    addDocument,
    updateDocument,
    deleteDocument,
  };
};
