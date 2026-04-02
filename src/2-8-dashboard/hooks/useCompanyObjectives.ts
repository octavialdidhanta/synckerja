import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/shared/lib/supabaseClient';
import { useToast } from '@/shared/components/ui/use-toast';
import { globalCompanyObjectivesManager } from './globalCompanyObjectivesManager';
import { logger } from '@/shared/lib/logger';

export interface CompanyObjective {
  id: string;
  organization_id: string;
  cycle_id: string;
  title: string;
  why_important?: string;
  status: 'draft' | 'active' | 'completed' | 'cancelled';
  progress_percentage: number;
  weight: number;
  start_date?: string;
  end_date?: string;
  owner_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface CreateCompanyObjectiveData {
  organization_id: string;
  cycle_id: string;
  title: string;
  why_important?: string;
  status?: 'draft' | 'active' | 'completed' | 'cancelled';
  weight?: number;
  start_date?: string;
  end_date?: string;
  owner_id: string;
  created_by: string;
}

export const useCompanyObjectives = (organizationId?: string, cycleIds?: string[]) => {
  const queryClient = useQueryClient();

  // 🌐 GLOBAL SUBSCRIPTION: Use singleton manager instead of creating duplicate subscriptions
  useEffect(() => {
    if (!organizationId) return;

    // Subscribe through global manager
    const unsubscribe = globalCompanyObjectivesManager.subscribe(organizationId, queryClient);

    // Return cleanup function
    return unsubscribe;
  }, [organizationId, queryClient]);

  // ⚡ OPTIMIZED: Always fetch ALL company objectives for the organization
  // Filter by cycleIds will be done client-side to avoid double fetch
  // This ensures we only have ONE query per organization, regardless of cycleIds
  return useQuery({
    queryKey: ['company-objectives', organizationId], // Remove cycleIds from query key to prevent double fetch
    queryFn: async () => {
      if (!organizationId) {
        const isDev = import.meta.env?.DEV;
        if (isDev) {
          console.log('❌ No organizationId provided');
        }
        return [];
      }
      
      const isDev = import.meta.env?.DEV;
      if (isDev) {
        console.log('🔍 Fetching company objectives:', { organizationId, cycleIds: 'ALL' });
      }
      
      // Always fetch ALL company objectives for the organization
      // OPTIMIZATION: Select only necessary fields to reduce payload size
      const startTime = performance.now();
      const { data, error } = await supabase
        .from('company_objectives')
        .select('id, organization_id, cycle_id, title, why_important, status, progress_percentage, weight, start_date, end_date, owner_id, created_by, created_at, updated_at')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });
      const duration = performance.now() - startTime;

      // Performance monitoring - threshold relaxed so normal slow fetches don't warn (query can be 4s+)
      logger.performance(`Company Objectives Fetch (${organizationId})`, duration, 5000);

      if (error) {
        console.error('❌ Error fetching company objectives:', error);
        throw error;
      }

      if (isDev) {
        console.log('✅ Company objectives fetched:', data);
      }
      return data || [];
    },
    enabled: !!organizationId,
    staleTime: 120 * 1000, // 120 seconds - increased cache time to reduce refetch frequency
    refetchOnMount: false, // Don't refetch on mount if data is fresh
    refetchOnWindowFocus: false, // Don't refetch on window focus
    gcTime: 5 * 60 * 1000, // 5 minutes - keep in cache longer
  });
};

export const useCreateCompanyObjective = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (objectiveData: CreateCompanyObjectiveData) => {
      console.log('🚀 Creating company objective:', objectiveData);

      const { data, error } = await supabase
        .from('company_objectives')
        .insert(objectiveData)
        .select()
        .single();

      if (error) {
        console.error('❌ Error creating company objective:', error);
        throw error;
      }

      console.log('✅ Company objective created successfully:', data);
      return data;
    },
    onSuccess: () => {
      // Invalidate all related queries for immediate UI update
      queryClient.invalidateQueries({ queryKey: ['company-objectives'] });
      queryClient.invalidateQueries({ queryKey: ['department-objectives'] });
      queryClient.invalidateQueries({ queryKey: ['individual-objectives'] });
      toast({
        title: 'Success',
        description: 'Company objective created successfully',
      });
    },
    onError: (error) => {
      console.error('❌ Failed to create company objective:', error);
      toast({
        title: 'Error',
        description: 'Failed to create company objective',
        variant: 'destructive',
      });
    },
  });
};

export const useUpdateCompanyObjective = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<CompanyObjective> }) => {
      console.log('🔄 Updating company objective:', { id, updates });

      const { data, error } = await supabase
        .from('company_objectives')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('❌ Error updating company objective:', error);
        throw error;
      }

      console.log('✅ Company objective updated successfully:', data);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-objectives'] });
      toast({
        title: 'Success',
        description: 'Company objective updated successfully',
      });
    },
    onError: (error) => {
      console.error('❌ Failed to update company objective:', error);
      toast({
        title: 'Error',
        description: 'Failed to update company objective',
        variant: 'destructive',
      });
    },
  });
};

export const useDeleteCompanyObjective = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (objectiveId: string) => {
      console.log('🗑️ Deleting company objective:', objectiveId);

      const { error } = await supabase
        .from('company_objectives')
        .delete()
        .eq('id', objectiveId);

      if (error) {
        console.error('❌ Error deleting company objective:', error);
        throw error;
      }

      console.log('✅ Company objective deleted successfully');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-objectives'] });
      queryClient.invalidateQueries({ queryKey: ['department-objectives'] });
      queryClient.invalidateQueries({ queryKey: ['individual-objectives'] });
      toast({
        title: 'Success',
        description: 'Company objective deleted successfully',
      });
    },
    onError: (error) => {
      console.error('❌ Failed to delete company objective:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete company objective',
        variant: 'destructive',
      });
    },
  });
};
