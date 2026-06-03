
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/shared/auth/contexts/AuthContext';
import { profileQueryKey } from '@/shared/auth/identityQuerySync';
import { supabase } from '@/shared/lib/supabaseClient';

export const useAvatarSync = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const syncAvatarAcrossApp = async (photoUrl: string | null) => {
    if (!user?.id) return;

    try {
      console.log('🔄 Starting avatar sync process for user:', user.id);
      console.log('📸 New photo URL:', photoUrl);

      // Update user_profile_details record
      const { error: detailsError } = await supabase
        .from('user_profile_details')
        .upsert({
          profile_id: user.id,
          profile_photo_url: photoUrl,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'profile_id' });

      if (detailsError) {
        console.error('❌ Error updating profile details photo:', detailsError);
        throw detailsError;
      }

      console.log('✅ Updated user_profile_details photo');

      // Update employee record photo
      const { error: employeeError } = await supabase
        .from('employees')
        .update({ 
          profile_photo_url: photoUrl,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (employeeError) {
        console.warn('⚠️ Employee update failed (might not exist):', employeeError);
      } else {
        console.log('✅ Updated employees photo');
      }

      // Invalidate ALL related queries to force fresh data
      const queriesToInvalidate = [
        'current-user-employee',
        'current-employee',
        'employee',
        'profile',
        'user-profile',
        'employees-optimized',
        'employees',
        'unified-user-data',
        'user-data', // header useUserData cache
      ];

      console.log('🔄 Invalidating queries:', queriesToInvalidate);
      
      for (const queryKey of queriesToInvalidate) {
        await queryClient.invalidateQueries({ queryKey: [queryKey] });
      }

      // Also invalidate specific employee detail queries for any employee ID
      await queryClient.invalidateQueries({ 
        predicate: (query) => {
          const queryKey = query.queryKey;
          // Invalidate any query that starts with ['employees-optimized', 'detail']
          return Array.isArray(queryKey) && 
                 queryKey[0] === 'employees-optimized' && 
                 queryKey[1] === 'detail';
        }
      });

      // Header uses useProfile → profileQueryKey(userId), not ['profile'] alone
      const profileKey = profileQueryKey(user.id);
      queryClient.setQueryData(profileKey, (oldData: { profile_photo_url?: string | null } | undefined) => {
        if (oldData) {
          console.log('💾 Updating profile cache data with new photo URL');
          return { ...oldData, profile_photo_url: photoUrl };
        }
        return oldData;
      });
      await queryClient.invalidateQueries({ queryKey: profileKey });

      // Force immediate cache update for current user employee
      queryClient.setQueryData(['current-user-employee', user.id], (oldData: any) => {
        if (oldData) {
          console.log('💾 Updating cache data with new photo URL');
          return { ...oldData, profile_photo_url: photoUrl };
        }
        return oldData;
      });

      queryClient.getQueryCache().getAll().forEach((query) => {
        const queryKey = query.queryKey;
        if (
          Array.isArray(queryKey) &&
          queryKey[0] === 'current-employee' &&
          queryKey[1] === user.id
        ) {
          const oldData = query.state.data as { profile_photo_url?: string | null } | undefined;
          if (oldData) {
            queryClient.setQueryData(queryKey, { ...oldData, profile_photo_url: photoUrl });
          }
        }
      });

      // Clear userDataCache from useUserData hook
      if (typeof window !== 'undefined' && (window as any).userDataCache) {
        (window as any).userDataCache.clear();
        console.log('💾 Cleared userDataCache for immediate header update');
      }

      // Also update employees cache if it exists
      queryClient.setQueryData(['employees-optimized'], (oldData: any) => {
        if (oldData && Array.isArray(oldData)) {
          return oldData.map((emp: any) => 
            emp.user_id === user.id 
              ? { ...emp, profile_photo_url: photoUrl }
              : emp
          );
        }
        return oldData;
      });

      // Update all employee detail caches for this user
      queryClient.getQueryCache().getAll().forEach((query) => {
        const queryKey = query.queryKey;
        if (Array.isArray(queryKey) && 
            queryKey[0] === 'employees-optimized' && 
            queryKey[1] === 'detail') {
          const employeeData = query.state.data as any;
          if (employeeData && employeeData.user_id === user.id) {
            queryClient.setQueryData(queryKey, {
              ...employeeData,
              profile_photo_url: photoUrl
            });
            console.log('💾 Updated employee detail cache for:', queryKey[2]);
          }
        }
      });

      console.log('✅ Avatar synced successfully across all components');
      return { success: true };
    } catch (error) {
      console.error('❌ Error syncing avatar:', error);
      return { success: false, error };
    }
  };

  return { syncAvatarAcrossApp };
};

