
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentUserEmployee } from '@/1-home/components/HomeOKRDashboard/component/SectionGreetingsImport/useCurrentUserEmployee';

interface MotivationLike {
  id: string;
  motivation_id: string;
  employee_id: string;
  created_at: string;
  employee?: {
    id: string;
    full_name: string;
  };
}

interface Motivation {
  id: string;
  content: string;
  author_name: string;
  is_anonymous: boolean;
  published_at: string;
  expires_at: string;
  status: string;
  created_by: string;
  likes?: MotivationLike[];
  likes_count?: number;
}

export const useMotivations = () => {
  const queryClient = useQueryClient();
  const { data: employeeData, isLoading: employeeLoading, error: employeeError } = useCurrentUserEmployee();

  const fetchMotivations = async () => {
    if (!employeeData?.organization_id) {
      console.warn('useMotivations: No organization_id available', { employeeData, employeeLoading, employeeError });
      return [];
    }

    try {
      // First get motivations
      const { data: motivationData, error: motivationError } = await supabase
        .from('motivations')
        .select('*')
        .eq('organization_id', employeeData.organization_id)
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString())
        .order('published_at', { ascending: false });

      if (motivationError) {
        console.error('Error fetching motivations:', motivationError);
        throw motivationError;
      }

      // Get all likes for these motivations
      const motivationIds = motivationData?.map(m => m.id) || [];
      
      if (motivationIds.length === 0) {
        return [];
      }

      const { data: likesData, error: likesError } = await supabase
        .from('motivation_likes')
        .select('id, motivation_id, employee_id, created_at')
        .in('motivation_id', motivationIds);

      if (likesError) {
        console.error('Error fetching likes:', likesError);
      }

      // Get employee data separately
      const employeeIds = [...new Set(likesData?.map(like => like.employee_id) || [])];
      const { data: employeesData } = await supabase
        .from('employees')
        .select('id, full_name')
        .in('id', employeeIds);

      // Combine the data
      const motivationsWithLikes = motivationData?.map(motivation => {
        const motivationLikes = likesData?.filter(like => like.motivation_id === motivation.id) || [];
        
        const likesWithEmployees = motivationLikes.map(like => {
          const employee = employeesData?.find(emp => emp.id === like.employee_id);
          return {
            ...like,
            employee: employee ? { id: employee.id, full_name: employee.full_name } : undefined
          };
        });

        return {
          ...motivation,
          likes: likesWithEmployees,
          likes_count: motivationLikes.length
        };
      }) || [];

      return motivationsWithLikes;
    } catch (error) {
      console.error('Error fetching motivations:', error);
      throw error;
    }
  };

  // Use React Query for motivation data
  const {
    data: motivations = [],
    isLoading,
    error: motivationsQueryError,
    refetch: refreshMotivations,
  } = useQuery({
    queryKey: ['motivations', employeeData?.organization_id],
    queryFn: fetchMotivations,
    enabled: !!employeeData?.organization_id && !employeeLoading,
    staleTime: 30000, // 30 seconds
  });

  const saveMotivation = async (content: string, isAnonymous: boolean, authorName?: string) => {
    if (!employeeData?.organization_id) {
      console.error('saveMotivation: Organization not found', { 
        employeeData, 
        employeeLoading, 
        employeeError,
        hasEmployeeData: !!employeeData,
        hasOrganizationId: !!employeeData?.organization_id
      });
      
      // If still loading, wait a bit and try to get organization data directly
      if (employeeLoading) {
        console.log('saveMotivation: Employee data still loading, attempting direct organization fetch...');
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('active_organization_id')
              .eq('user_id', user.id)
              .maybeSingle();
            
            if (profile?.active_organization_id) {
              console.log('saveMotivation: Found organization via direct fetch:', profile.active_organization_id);
              // Continue with the found organization ID
              const orgId = profile.active_organization_id;
              
              // Proceed with the save using the found organization ID
              const { data: userData } = await supabase.auth.getUser();
              if (!userData.user) {
                throw new Error('User not authenticated');
              }

              // Check daily limit (2 motivations per day)
              const today = new Date().toISOString().split('T')[0];
              const { data: todayMotivations, error: checkError } = await supabase
                .from('motivations')
                .select('id')
                .eq('created_by', userData.user.id)
                .eq('organization_id', orgId)
                .gte('created_at', today + ' 00:00:00')
                .lt('created_at', today + ' 23:59:59');

              if (checkError) {
                console.error('Error checking daily limit:', checkError);
                throw new Error('Gagal memeriksa batas harian');
              }

              if (todayMotivations && todayMotivations.length >= 2) {
                throw new Error('Anda sudah menulis 2 motivasi hari ini. Batas harian tercapai.');
              }

              const { data, error } = await supabase
                .from('motivations')
                .insert({
                  organization_id: orgId,
                  content: content.trim(),
                  author_name: isAnonymous ? 'Unknown' : (authorName || 'Unknown'),
                  is_anonymous: isAnonymous,
                  created_by: userData.user.id,
                })
                .select()
                .single();

              if (error) {
                console.error('Error saving motivation:', error);
                throw error;
              }

              // Invalidate query to trigger real-time refresh
              queryClient.invalidateQueries({ queryKey: ['motivations', orgId] });
              return data;
            }
          }
        } catch (directFetchError) {
          console.error('saveMotivation: Direct organization fetch failed:', directFetchError);
        }
      }
      
      throw new Error('Organization not found. Please ensure you are logged in and have selected an organization.');
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        throw new Error('User not authenticated');
      }

      // Check daily limit (2 motivations per day)
      const today = new Date().toISOString().split('T')[0];
      const { data: todayMotivations, error: checkError } = await supabase
        .from('motivations')
        .select('id')
        .eq('created_by', userData.user.id)
        .eq('organization_id', employeeData.organization_id)
        .gte('created_at', today + ' 00:00:00')
        .lt('created_at', today + ' 23:59:59');

      if (checkError) {
        console.error('Error checking daily limit:', checkError);
        throw new Error('Gagal memeriksa batas harian');
      }

      if (todayMotivations && todayMotivations.length >= 2) {
        throw new Error('Anda sudah menulis 2 motivasi hari ini. Batas harian tercapai.');
      }

      const { data, error } = await supabase
        .from('motivations')
        .insert({
          organization_id: employeeData.organization_id,
          content: content.trim(),
          author_name: isAnonymous ? 'Unknown' : (authorName || 'Unknown'),
          is_anonymous: isAnonymous,
          created_by: userData.user.id,
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving motivation:', error);
        throw error;
      }

      // Invalidate query to trigger real-time refresh
      queryClient.invalidateQueries({ queryKey: ['motivations', employeeData.organization_id] });
      return data;
    } catch (error) {
      console.error('Error saving motivation:', error);
      throw error;
    }
  };




  const deleteMotivation = async (motivationId: string) => {
    try {
      const { error } = await supabase
        .from('motivations')
        .delete()
        .eq('id', motivationId);

      if (error) {
        console.error('Error deleting motivation:', error);
        throw error;
      }

      // Invalidate query to trigger real-time refresh
      queryClient.invalidateQueries({ queryKey: ['motivations', employeeData?.organization_id] });
    } catch (error) {
      console.error('Error deleting motivation:', error);
      throw error;
    }
  };

  const updateMotivation = async (motivationId: string, content: string, isAnonymous: boolean, authorName?: string) => {
    try {
      const { error } = await supabase
        .from('motivations')
        .update({
          content: content.trim(),
          author_name: isAnonymous ? 'Unknown' : (authorName || 'Unknown'),
          is_anonymous: isAnonymous,
        })
        .eq('id', motivationId);

      if (error) {
        console.error('Error updating motivation:', error);
        throw error;
      }

      // Invalidate query to trigger real-time refresh
      queryClient.invalidateQueries({ queryKey: ['motivations', employeeData?.organization_id] });
    } catch (error) {
      console.error('Error updating motivation:', error);
      throw error;
    }
  };

  const toggleLike = async (motivationId: string) => {
    if (!employeeData?.id || !employeeData?.organization_id) {
      throw new Error('Employee data not found');
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        throw new Error('User not authenticated');
      }

      // Check if user already liked this motivation (0 rows → .single() causes 406 Not Acceptable)
      const { data: existingLike, error: likeLookupError } = await supabase
        .from('motivation_likes')
        .select('id')
        .eq('motivation_id', motivationId)
        .eq('employee_id', employeeData.id)
        .maybeSingle();

      if (likeLookupError) {
        console.error('Error checking motivation like:', likeLookupError);
        throw likeLookupError;
      }

      if (existingLike) {
        // Unlike - remove the like
        const { error } = await supabase
          .from('motivation_likes')
          .delete()
          .eq('id', existingLike.id);

        if (error) {
          console.error('Error unliking motivation:', error);
          throw error;
        }
      } else {
        // Like - add new like
        const { error } = await supabase
          .from('motivation_likes')
          .insert({
            motivation_id: motivationId,
            employee_id: employeeData.id,
            organization_id: employeeData.organization_id,
          });

        if (error) {
          console.error('Error liking motivation:', error);
          throw error;
        }
      }

      // Invalidate query to trigger real-time refresh
      queryClient.invalidateQueries({ queryKey: ['motivations', employeeData.organization_id] });
      return !existingLike; // Return true if liked, false if unliked
    } catch (error) {
      console.error('Error toggling like:', error);
      throw error;
    }
  };

  const combinedError =
    (employeeError as Error | null | undefined) ||
    (motivationsQueryError as Error | null | undefined) ||
    null;

  return {
    motivations,
    isLoading: isLoading || employeeLoading,
    error: combinedError instanceof Error
      ? combinedError
      : combinedError
        ? new Error(String(combinedError))
        : null,
    saveMotivation,
    deleteMotivation,
    updateMotivation,
    toggleLike,
    refreshMotivations,
    employeeData,
    employeeError,
  };
};
