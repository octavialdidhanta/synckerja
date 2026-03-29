import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { toast } from 'sonner';

export interface TrainingProgram {
  id: string;
  name: string;
  category: string;
  description?: string;
  trainer_name?: string;
  location?: string;
  start_date: string;
  end_date: string;
  max_participants: number;
  budget: number;
  objectives?: string;
  requirements?: string;
  materials?: string;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
  participants?: any[];
}

export interface TrainingParticipant {
  id: string;
  training_program_id: string;
  employee_id: string;
  status: 'registered' | 'completed' | 'cancelled';
  completion_date?: string;
  rating?: number;
  feedback?: string;
  employee?: {
    full_name: string;
    email: string;
  };
}

export const useTrainingPrograms = () => {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();

  const { data: programs = [], isLoading } = useQuery({
    queryKey: ['training-programs', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      console.log('Fetching training programs for organization:', organizationId);

      const { data, error } = await supabase
        .from('training_programs')
        .select(`
          *,
          training_participants!left(
            id,
            employee_id,
            status,
            completion_date,
            rating,
            feedback,
            employees(full_name, email)
          )
        `)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching training programs:', error);
        throw error;
      }

      console.log('Fetched training programs:', data);
      return data as TrainingProgram[];
    },
    enabled: !!organizationId,
  });

  const createProgram = useMutation({
    mutationFn: async (program: Omit<TrainingProgram, 'id' | 'created_at' | 'updated_at'>) => {
      if (!organizationId) throw new Error('Organization not found');

      const { data, error } = await supabase
        .from('training_programs')
        .insert({ ...program, organization_id: organizationId })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-programs'] });
      toast.success('Program training berhasil dibuat');
    },
    onError: (error) => {
      toast.error('Gagal membuat program training');
      console.error('Error creating training program:', error);
    },
  });

  const updateProgram = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TrainingProgram> & { id: string }) => {
      const { data, error } = await supabase
        .from('training_programs')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-programs'] });
      toast.success('Program training berhasil diupdate');
    },
    onError: (error) => {
      toast.error('Gagal mengupdate program training');
      console.error('Error updating training program:', error);
    },
  });

  const deleteProgram = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('training_programs')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-programs'] });
      toast.success('Program training berhasil dihapus');
    },
    onError: (error) => {
      toast.error('Gagal menghapus program training');
      console.error('Error deleting training program:', error);
    },
  });

  return {
    programs,
    isLoading,
    createProgram,
    updateProgram,
    deleteProgram,
  };
};


