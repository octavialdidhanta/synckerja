import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';

export interface FamilyMember {
  id: string;
  employee_id: string;
  organization_id?: string;
  name: string;
  relationship: string;
  gender?: string;
  age?: number;
  occupation?: string;
  address?: string;
  phone?: string;
  is_emergency_contact?: boolean;
  photo_url?: string;
  created_at: string;
  updated_at: string;
}

export const useFamilyMembers = (employeeId: string) => {
  const queryClient = useQueryClient();

  const {
    data: familyMembers = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['family-members', employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_family_members')
        .select('*')
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as FamilyMember[];
    },
    enabled: !!employeeId,
  });

  const addFamilyMember = useMutation({
    mutationFn: async (familyMemberData: Omit<FamilyMember, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('employee_family_members')
        .insert([familyMemberData])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family-members', employeeId] });
    },
  });

  const updateFamilyMember = useMutation({
    mutationFn: async ({
      id,
      data: familyMemberData,
    }: {
      id: string;
      data: Partial<Omit<FamilyMember, 'id' | 'created_at' | 'updated_at'>>;
    }) => {
      const { data, error } = await supabase
        .from('employee_family_members')
        .update({ ...familyMemberData, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family-members', employeeId] });
    },
  });

  const deleteFamilyMember = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('employee_family_members')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family-members', employeeId] });
    },
  });

  return {
    familyMembers,
    isLoading,
    error,
    addFamilyMember,
    updateFamilyMember,
    deleteFamilyMember,
  };
};
