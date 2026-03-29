
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { supabase } from '@/shared/lib/supabaseClient';
import { Objective, OkrStatus } from './okr';
import { useToast } from '@/shared/components/ui/use-toast';
import { isValidUUID } from '@/shared/lib/uuidValidation';

export const useObjectives = (organizationId?: string, cycleId?: string, level?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Set up real-time subscriptions for all objective tables
  useEffect(() => {
    if (!organizationId) return;

    // console.log('🔄 Setting up real-time subscriptions for objectives:', { level, organizationId });

    const channels: any[] = [];

    // Subscribe to company objectives
    const companyChannel = supabase
      .channel('company_objectives_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'company_objectives',
          filter: `organization_id=eq.${organizationId}`
        },
        (payload) => {
          // console.log('📡 Real-time update for company objectives:', payload);
          queryClient.invalidateQueries({ queryKey: [`${level}-objectives`, organizationId, cycleId] });
          queryClient.invalidateQueries({ queryKey: ['company-objectives'] });
        }
      );

    // Subscribe to department objectives
    const deptChannel = supabase
      .channel('department_objectives_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'department_objectives',
          filter: `organization_id=eq.${organizationId}`
        },
        (payload) => {
          // console.log('📡 Real-time update for department objectives:', payload);
          queryClient.invalidateQueries({ queryKey: [`${level}-objectives`, organizationId, cycleId] });
          queryClient.invalidateQueries({ queryKey: ['department-objectives'] });
        }
      );

    // Subscribe to individual objectives
    const indivChannel = supabase
      .channel('individual_objectives_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'individual_objectives',
          filter: `organization_id=eq.${organizationId}`
        },
        (payload) => {
          // console.log('📡 Real-time update for individual objectives:', payload);
          queryClient.invalidateQueries({ queryKey: [`${level}-objectives`, organizationId, cycleId] });
          queryClient.invalidateQueries({ queryKey: ['individual-objectives'] });
        }
      );

    // Subscribe to key results for real-time updates
    const keyResultsChannel = supabase
      .channel('key_results_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'key_results',
          filter: `organization_id=eq.${organizationId}`
        },
        (payload) => {
          // console.log('📡 Real-time update for key results:', payload);
          queryClient.invalidateQueries({ queryKey: [`${level}-objectives`, organizationId, cycleId] });
          queryClient.invalidateQueries({ queryKey: ['key-results'] });
        }
      );

    channels.push(companyChannel, deptChannel, indivChannel, keyResultsChannel);

    // Subscribe to all channels
    channels.forEach(channel => channel.subscribe());

    return () => {
      // console.log('🔄 Cleaning up objective real-time subscriptions');
      channels.forEach(channel => {
        try {
          supabase.removeChannel(channel);
        } catch (error) {
          // Ignore WebSocket cleanup errors
          if (process.env.NODE_ENV === 'development') {
            console.warn('⚠️ WebSocket cleanup warning:', error);
          }
        }
      });
    };
  }, [organizationId, cycleId, level, queryClient]);

  const { data: objectives = [], isLoading, error, refetch } = useQuery({
    queryKey: [`${level}-objectives`, organizationId, cycleId],
    queryFn: async () => {
      if (!organizationId) {
        // console.log('❌ No organizationId provided');
        return [];
      }
      
      // console.log('🔍 Fetching objectives:', { organizationId, cycleId, level });
      
      // Use the new hierarchy tables based on level
      let data: any[] = [];
      
      if (level === 'company') {
        // Get from company_objectives with department objectives as key results
        let query = supabase
          .from('company_objectives')
          .select(`
            *,
            department_objectives!company_objective_id(
              id,
              title,
              progress_percentage,
              weight,
              status
            )
          `)
          .eq('organization_id', organizationId);

        if (cycleId && isValidUUID(cycleId)) {
          query = query.eq('cycle_id', cycleId);
        }

        const { data: companyData, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        
        data = companyData?.map(obj => ({
          ...obj,
          why_important: obj.why_important || '',
          level: 'company' as const,
          key_results: (obj.department_objectives || []).map((dept: any) => ({
            id: dept.id,
            title: dept.title,
            current_value: dept.progress_percentage,
            target_value: 100,
            progress_percentage: dept.progress_percentage,
            weight: dept.weight,
            status: dept.status,
            metric_type: 'percentage',
            unit: '%'
          })),
          child_objectives: [],
          parent_objective: null,
          entity_id: null,
          parent_objective_id: null,
          department_id: null,
          derived_from_kr_id: null,
          weight: obj.weight || 100
        })) || [];
        
      } else if (level === 'department') {
        // Get from department_objectives with individual objectives and key results
        let query = supabase
          .from('department_objectives')
          .select(`
            *,
            individual_objectives!department_objective_id(
              id,
              title,
              progress_percentage,
              weight,
              status
            )
          `)
          .eq('organization_id', organizationId);

        if (cycleId && isValidUUID(cycleId)) {
          query = query.eq('cycle_id', cycleId);
        }

        const { data: deptData, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        
        // Fetch key_results for all department objectives
        // Only get key results that are specifically for department objectives (not for company objectives)
        const deptIds = deptData?.map(obj => obj.id) || [];
        let keyResultsData: any[] = [];
        if (deptIds.length > 0) {
          const { data: krData } = await supabase
            .from('key_results')
            .select('id, title, target_value, current_value, unit, metric_type, progress_percentage, weight, department_objective_id, company_objective_id')
            .in('department_objective_id', deptIds)
            .is('company_objective_id', null); // Only get key results that are NOT for company objectives
          keyResultsData = krData || [];
        }
        
        // Group key results by department_objective_id
        const keyResultsByDeptId = new Map<string, any[]>();
        keyResultsData?.forEach(kr => {
          if (kr.department_objective_id) {
            const existing = keyResultsByDeptId.get(kr.department_objective_id) || [];
            existing.push(kr);
            keyResultsByDeptId.set(kr.department_objective_id, existing);
          }
        });
        
        data = deptData?.map(obj => {
          // Get actual key results from key_results table
          const allKeyResultsFromDB = keyResultsByDeptId.get(obj.id) || [];
          
          // Filter out key results that have the same title as the department objective
          // (these are duplicates created for company objectives)
          const actualKeyResults = allKeyResultsFromDB.filter((kr: any) => {
            // Exclude if title matches exactly (case-insensitive)
            const titleMatches = kr.title?.toLowerCase().trim() === obj.title?.toLowerCase().trim();
            // Also exclude if it has company_objective_id (should already be filtered, but double-check)
            const hasCompanyObjectiveId = kr.company_objective_id !== null && kr.company_objective_id !== undefined;
            return !titleMatches && !hasCompanyObjectiveId;
          });
          
          // Convert individual objectives to key result format (for display purposes)
          const individualAsKeyResults = (obj.individual_objectives || []).map((indiv: any) => ({
            id: indiv.id,
            title: indiv.title,
            current_value: indiv.progress_percentage,
            target_value: 100,
            progress_percentage: indiv.progress_percentage,
            weight: indiv.weight,
            status: indiv.status,
            metric_type: 'percentage',
            unit: '%',
            source_type: 'individual_objective'
          }));
          
          // Combine actual key results with individual objectives
          // Prioritize actual key results, then add individual objectives
          const allKeyResults = [...actualKeyResults, ...individualAsKeyResults];
          
          return {
            ...obj,
            why_important: obj.why_important || '',
            level: 'department' as const,
            key_results: allKeyResults,
            child_objectives: [],
            parent_objective: null,
            entity_id: null,
            parent_objective_id: obj.company_objective_id,
            derived_from_kr_id: null,
            weight: obj.weight || 100
          };
        }) || [];
        
      } else if (level === 'individual') {
        // Get from individual_objectives with related key results
        // console.log('🔍 Fetching individual objectives:', { organizationId, cycleId, level });
        
        // First, let's try a simpler query to check if individual objectives exist
        let query = supabase
          .from('individual_objectives')
          .select('*')
          .eq('organization_id', organizationId);

        if (cycleId && isValidUUID(cycleId)) {
          // console.log('🔍 Applying cycle filter for individual objectives:', cycleId);
          query = query.eq('cycle_id', cycleId);
        } else {
          // console.log('⚠️ No cycleId provided for individual objectives - fetching all');
        }

        const { data: indivData, error } = await query.order('created_at', { ascending: false });
        if (error) {
          console.error('❌ Error fetching individual objectives:', error);
          return [];
        }
        
        // console.log('📊 Raw individual objectives data:', {
        //   count: indivData?.length || 0,
        //   objectives: indivData?.map(obj => ({
        //     id: obj.id,
        //     title: obj.title,
        //     cycle_id: obj.cycle_id,
        //     employee_id: obj.employee_id
        //   })) || []
        // });
        
        // Now fetch key results for each individual objective
        const objectivesWithKeyResults = await Promise.all(
          (indivData || []).map(async (obj) => {
            const { data: keyResults } = await supabase
              .from('key_results')
              .select('*')
              .eq('individual_objective_id', obj.id);
            
            return {
              ...obj,
              key_results: keyResults || []
            };
          })
        );
        
        // console.log('📊 Individual objectives with key results:', {
        //   count: objectivesWithKeyResults.length,
        //   objectives: objectivesWithKeyResults.map(obj => ({
        //     id: obj.id,
        //     title: obj.title,
        //     keyResultsCount: obj.key_results.length
        //   }))
        // });
        
        data = objectivesWithKeyResults?.map(obj => ({
          ...obj,
          why_important: obj.why_important || '',
          level: 'individual' as const,
          key_results: obj.key_results || [],
          child_objectives: [],
          parent_objective: null,
          entity_id: null,
          parent_objective_id: obj.department_objective_id,
          department_id: null,
          derived_from_kr_id: null,
          weight: obj.weight || 100
        })) || [];
        
      } else {
        // Get company objectives by default with department objectives as key results
        const query = supabase
          .from('company_objectives')
          .select(`
            *,
            department_objectives!company_objective_id(
              id,
              title,
              progress_percentage,
              weight,
              status
            )
          `)
          .eq('organization_id', organizationId);

        const { data: companyData, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        
        data = companyData?.map(obj => ({
          ...obj,
          why_important: obj.why_important || '',
          level: 'company' as const,
          key_results: (obj.department_objectives || []).map((dept: any) => ({
            id: dept.id,
            title: dept.title,
            current_value: dept.progress_percentage,
            target_value: 100,
            progress_percentage: dept.progress_percentage,
            weight: dept.weight,
            status: dept.status,
            metric_type: 'percentage',
            unit: '%'
          })),
          child_objectives: [],
          parent_objective: null,
          entity_id: null,
          parent_objective_id: null,
          department_id: null,
          derived_from_kr_id: null,
          weight: obj.weight || 100
        })) || [];
      }

      // console.log('✅ Objectives loaded:', data.length);
      return data as Objective[];
    },
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
  });

  // Memoize the return value to prevent unnecessary re-renders
  const returnValue = useMemo(() => ({
    data: objectives, // Return as 'data' for consistency
    objectives,
    isLoading,
    error,
    refetch
  }), [objectives, isLoading, error, refetch]);

  return returnValue;
};

// Interface for company objective creation
interface CreateObjectiveData {
  organization_id: string;
  cycle_id?: string | null;
  title: string;
  why_important: string;
  level: 'company' | 'department' | 'individual'; // Keep for compatibility but won't be stored
  owner_id: string;
  status?: 'draft' | 'active' | 'completed' | 'cancelled';
  weight?: number;
  created_by: string;
  // Additional fields for compatibility (these won't be stored in company_objectives)
  department_id?: string;
  parent_objective_id?: string;
  entity_id?: string;
}

export const useCreateObjective = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (objectiveData: CreateObjectiveData) => {
      console.log('🚀 Creating objective:', objectiveData);

      // Prepare the data for company_objectives table
      const finalObjectiveData = {
        organization_id: objectiveData.organization_id,
        cycle_id: objectiveData.cycle_id || null,
        title: objectiveData.title,
        why_important: objectiveData.why_important,
        status: objectiveData.status || 'draft',
        weight: objectiveData.weight || 100.00,
        progress_percentage: 0.00,
        owner_id: objectiveData.owner_id,
        created_by: objectiveData.created_by,
        start_date: null,
        end_date: null
      };

      console.log('📝 Final objective data being sent:', finalObjectiveData);

      const { data: objective, error } = await supabase
        .from('company_objectives')
        .insert(finalObjectiveData)
        .select()
        .single();

      if (error) {
        console.error('❌ Error creating objective:', error);
        throw error;
      }

      console.log('✅ Objective created successfully:', {
        id: objective.id,
        title: objective.title,
        status: objective.status,
        organization_id: objective.organization_id
      });

      // Company objectives don't have parent-child relationships in this table

      return objective;
    },
    onSuccess: () => {
      // Invalidate all OKR-related queries to ensure UI refresh
      queryClient.invalidateQueries({ queryKey: ['company-objectives'] });
      queryClient.invalidateQueries({ queryKey: ['department-objectives'] });
      queryClient.invalidateQueries({ queryKey: ['individual-objectives'] });
      queryClient.invalidateQueries({ queryKey: ['okr-hierarchy'] });
      queryClient.invalidateQueries({ queryKey: ['objectives'] });
      // Invalidate objective stats queries for all types
      queryClient.invalidateQueries({ queryKey: ['objective-stats'] });
      toast({
        title: 'Success',
        description: 'Objective created successfully',
      });
    },
    onError: (error) => {
      console.error('❌ Failed to create objective:', error);
      toast({
        title: 'Error',
        description: 'Failed to create objective',
        variant: 'destructive',
      });
    },
  });
};
