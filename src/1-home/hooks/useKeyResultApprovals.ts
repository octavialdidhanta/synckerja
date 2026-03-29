import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useToast } from '@/shared/components/ui/use-toast';

export interface KeyResultApproval {
  id: string;
  key_result_id: string;
  organization_id: string;
  status: 'pending' | 'approved' | 'rejected';
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export const useKeyResultApprovals = (organizationId?: string) => {
  return useQuery({
    queryKey: ['key-result-approvals', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const { data, error } = await supabase
        .from('key_result_approvals')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
  });
};

export const useApproveKeyResult = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ approvalId, notes }: { approvalId: string; notes?: string }) => {
      const { data, error } = await supabase
        .from('key_result_approvals')
        .update({
          status: 'approved',
          approved_by: (await supabase.auth.getUser()).data.user?.id,
          approved_at: new Date().toISOString(),
          notes,
        })
        .eq('id', approvalId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['key-result-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['key-results'] });
      toast({
        title: 'Success',
        description: 'Key Result berhasil di-approve',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Gagal approve Key Result',
        variant: 'destructive',
      });
      console.error('Error approving key result:', error);
    },
  });
};

export const useRejectKeyResult = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      approvalId, 
      rejectionReason, 
      notes 
    }: { 
      approvalId: string; 
      rejectionReason: string; 
      notes?: string; 
    }) => {
      const { data, error } = await supabase
        .from('key_result_approvals')
        .update({
          status: 'rejected',
          approved_by: (await supabase.auth.getUser()).data.user?.id,
          approved_at: new Date().toISOString(),
          rejection_reason: rejectionReason,
          notes,
        })
        .eq('id', approvalId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['key-result-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['key-results'] });
      toast({
        title: 'Success',
        description: 'Key Result berhasil di-reject',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Gagal reject Key Result',
        variant: 'destructive',
      });
      console.error('Error rejecting key result:', error);
    },
  });
};

export const useCreateKeyResultApproval = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ keyResultId, organizationId }: { keyResultId: string; organizationId: string }) => {
      // First check if the key result exists - use maybeSingle to avoid errors if not found
      const { data: keyResult, error: checkError } = await supabase
        .from('key_results')
        .select('id')
        .eq('id', keyResultId)
        .maybeSingle();

      if (checkError) {
        throw new Error(`Database error: ${checkError.message}`);
      }

      if (!keyResult) {
        throw new Error('Key Result tidak ditemukan. Pastikan Key Result masih ada di database.');
      }

      const { data, error } = await supabase
        .from('key_result_approvals')
        .insert({
          key_result_id: keyResultId,
          organization_id: organizationId,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['key-result-approval'] });
      toast({
        title: 'Success',
        description: 'Approval request berhasil dibuat',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Gagal membuat approval request',
        variant: 'destructive',
      });
      console.error('Error creating key result approval:', error);
    },
  });
};

export const useGetKeyResultApproval = (keyResultId?: string) => {
  return useQuery({
    queryKey: ['key-result-approval', keyResultId],
    queryFn: async () => {
      if (!keyResultId) return null;

      const { data, error } = await supabase
        .from('key_result_approvals')
        .select('*')
        .eq('key_result_id', keyResultId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!keyResultId,
  });
};