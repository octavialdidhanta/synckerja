
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';

export const useCurrentUserRole = () => {
  return useQuery({
    queryKey: ['currentUserRole'],
    queryFn: async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        console.log('🔍 Fetching user role for active organization:', user.email);

        // Get active organization from profile first for debugging
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('active_organization_id')
          .eq('user_id', user.id)
          .single();

        if (profileError) {
          console.error('❌ Error fetching profile:', profileError);
          return null;
        }

        console.log('📋 User active organization ID:', profile?.active_organization_id);

        // Use the new specific function to get role in active organization
        const { data: roleData, error: roleError } = await supabase.rpc('get_user_role_in_active_org');
        
        if (roleError) {
          console.error('❌ Error fetching user role in active org:', roleError);
          return null;
        }

        console.log('👤 User role in active organization:', roleData);
        
        return roleData;
      } catch (error) {
        console.error('❌ Error in useCurrentUserRole:', error);
        return null;
      }
    },
    staleTime: 10 * 60 * 1000, // 10 menit - lebih lama dari sebelumnya
    gcTime: 15 * 60 * 1000, // 15 menit cache time
    refetchOnWindowFocus: false, // Tidak refetch saat window focus
    refetchOnMount: false, // Tidak refetch saat mount jika data masih fresh
    refetchInterval: false, // Hapus refetch interval yang berlebihan
    retry: 1, // Kurangi retry attempts
    retryDelay: 5000, // 5 detik delay untuk retry
  });
};
