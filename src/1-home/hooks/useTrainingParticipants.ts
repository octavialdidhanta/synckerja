import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useCurrentUserEmployee } from '@/1-home/components/HomeOKRDashboard/component/SectionGreetingsImport/useCurrentUserEmployee';
import { toast } from 'sonner';

export interface TrainingParticipant {
  id: string;
  training_program_id: string;
  employee_id: string;
  status: 'registered' | 'completed' | 'cancelled' | 'pending' | 'approved' | 'rejected';
  completion_date?: string;
  rating?: number;
  feedback?: string;
  registered_by?: string;
  approved_by?: string;
  approved_at?: string;
  registration_reason?: string;
  consent_checklist?: {
    penalty_agreement?: boolean;
    attendance_commitment?: boolean;
    participation_commitment?: boolean;
    confidentiality_agreement?: boolean;
    evaluation_agreement?: boolean;
  };
  employee?: {
    full_name: string;
    email: string;
    department?: {
      name: string;
    };
    job_positions?: {
      name: string;
    };
  };
}

export const useTrainingParticipants = (programId?: string) => {
  const { organizationId } = useCurrentOrg();
  const { data: currentEmployee } = useCurrentUserEmployee();
  const queryClient = useQueryClient();

  const { data: participants = [], isLoading, refetch } = useQuery({
    queryKey: ['training-participants', organizationId, programId],
    queryFn: async () => {
      if (!organizationId || !programId) return [];

      console.log('Fetching training participants for program:', programId);

      const { data, error } = await supabase
        .from('training_participants')
        .select(`
          *,
          employees!inner(
            full_name,
            email,
            departments!left(name),
            job_positions!left(name)
          )
        `)
        .eq('training_program_id', programId);

      if (error) {
        console.error('Error fetching training participants:', error);
        throw error;
      }

      console.log('Raw training participants data:', data);

      // Transform data to match the expected structure
      const transformedData = (data as any).map((participant: any) => ({
        ...participant,
        employee: {
          full_name: participant.employees?.full_name || 'Unknown Employee',
          email: participant.employees?.email || '',
          department: participant.employees?.departments ? { name: participant.employees.departments.name } : undefined,
          job_positions: participant.employees?.job_positions ? { name: participant.employees.job_positions.name } : undefined,
        }
      }));

      console.log('Transformed training participants:', transformedData);
      return transformedData as TrainingParticipant[];
    },
    enabled: !!organizationId && !!programId,
  });

  const addParticipants = useMutation({
    mutationFn: async ({ 
      employeeIds, 
      isDirectRegistration = false, 
      registrationReason, 
      consentChecklist 
    }: { 
      employeeIds: string[], 
      isDirectRegistration?: boolean,
      registrationReason?: string,
      consentChecklist?: {
        penalty_agreement: boolean;
        attendance_commitment: boolean;
        participation_commitment: boolean;
        confidentiality_agreement: boolean;
        evaluation_agreement: boolean;
      }
    }) => {
      if (!programId) throw new Error('Program ID is required');

      const participantsData = employeeIds.map(employeeId => ({
        training_program_id: programId,
        employee_id: employeeId,
        status: isDirectRegistration ? 'registered' as const : 'pending' as const,
        registered_by: isDirectRegistration ? currentEmployee?.id : null,
        registration_reason: registrationReason || null,
        consent_checklist: consentChecklist || {},
      }));

      const { data, error } = await (supabase as any)
        .from('training_participants')
        .insert(participantsData)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['training-participants'] });
      queryClient.invalidateQueries({ queryKey: ['available-employees'] });
      queryClient.invalidateQueries({ queryKey: ['latest-training-programs'] });
      queryClient.invalidateQueries({ queryKey: ['training-programs'] });
      
      if (variables.isDirectRegistration) {
        toast.success('Peserta berhasil didaftarkan');
      } else {
        toast.success('Pendaftaran berhasil! Menunggu persetujuan HRD.');
      }
    },
    onError: (error) => {
      toast.error('Gagal mendaftarkan peserta');
      console.error('Error adding participants:', error);
    },
  });

  const updateParticipantStatus = useMutation({
    mutationFn: async ({ id, status, approved_by }: { id: string, status: 'approved' | 'rejected', approved_by?: string }) => {
      const updates: any = {
        status: status === 'approved' ? 'registered' : 'rejected',
      };
      
      if (status === 'approved' && approved_by) {
        updates.approved_by = approved_by;
        updates.approved_at = new Date().toISOString();
      }

      const { data, error } = await (supabase as any)
        .from('training_participants')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['training-participants'] });
      queryClient.invalidateQueries({ queryKey: ['latest-training-programs'] });
      queryClient.invalidateQueries({ queryKey: ['training-programs'] });
      
      const message = variables.status === 'approved' ? 'Peserta berhasil disetujui' : 'Peserta ditolak';
      toast.success(message);
    },
    onError: (error) => {
      toast.error('Gagal mengupdate status peserta');
      console.error('Error updating participant status:', error);
    },
  });

  const updateParticipant = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TrainingParticipant> & { id: string }) => {
      const { data, error } = await (supabase as any)
        .from('training_participants')
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-participants'] });
      toast.success('Status peserta berhasil diupdate');
    },
    onError: (error) => {
      toast.error('Gagal mengupdate status peserta');
      console.error('Error updating participant:', error);
    },
  });

  const removeParticipant = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('training_participants')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-participants'] });
      queryClient.invalidateQueries({ queryKey: ['available-employees'] });
      queryClient.invalidateQueries({ queryKey: ['latest-training-programs'] });
      queryClient.invalidateQueries({ queryKey: ['training-programs'] });
      toast.success('Peserta berhasil dihapus');
    },
    onError: (error) => {
      toast.error('Gagal menghapus peserta');
      console.error('Error removing participant:', error);
    },
  });

  return {
    participants,
    isLoading,
    refetch,
    addParticipants,
    updateParticipantStatus,
    updateParticipant,
    removeParticipant,
  };
};


