
import { supabase } from '@/shared/lib/supabaseClient';
import { useShowToast } from './useShowToast';

export const useDataCleanup = () => {
  const showToast = useShowToast();

  const cleanupUserData = async (userId: string): Promise<boolean> => {
    try {
      console.log('Starting data cleanup for user:', userId);

      // Get user's organization from user_organizations table
      const { data: userOrgs, error: userOrgsError } = await supabase
        .from('user_organizations')
        .select('organization_id')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (userOrgsError) {
        console.error('Error fetching user organizations:', userOrgsError);
        return false;
      }

      if (!userOrgs || userOrgs.length === 0) {
        console.log('User has no active organizations');
        return true;
      }

      const organizationId = userOrgs[0].organization_id;

      // Check current profile state
      const { data: currentProfile, error: profileError } = await supabase
        .from('profiles')
        .select('active_organization_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (profileError) {
        console.error('Error fetching current profile:', profileError);
        return false;
      }

      // Only update if profile is missing active organization data
      if (!currentProfile?.active_organization_id) {
        console.log('Profile missing active organization data, updating...');
        
        const { error: profileUpdateError } = await supabase
          .from('profiles')
          .update({
            active_organization_id: organizationId,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);

        if (profileUpdateError) {
          console.error('Error updating profile:', profileUpdateError);
          return false;
        }

        console.log('Profile updated with organization data');
      } else {
        console.log('Profile already has organization data');
      }

      // Verify role exists
      const { data: userRole, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (roleError) {
        console.error('Error checking user role:', roleError);
      } else if (!userRole) {
        console.log('User has no role, this might need manual assignment');
      } else {
        console.log('User role verified:', userRole.role);
      }

      console.log('Data cleanup completed successfully for user:', userId);
      return true;
    } catch (error) {
      console.error('Error during data cleanup:', error);
      return false;
    }
  };

  const cleanupAllInconsistentData = async () => {
    try {
      // Find profiles with missing organization data but have user_organizations
      const { data: inconsistentProfiles, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          user_id,
          active_organization_id,
          user_organizations!inner(organization_id)
        `)
        .is('active_organization_id', null);

      if (profilesError) {
        console.error('Error finding inconsistent profiles:', profilesError);
        showToast({
          title: "Error",
          description: "Failed to identify inconsistent data",
          variant: "destructive",
        });
        return;
      }

      if (!inconsistentProfiles || inconsistentProfiles.length === 0) {
        showToast({
          title: "Info",
          description: "No inconsistent data found",
        });
        return;
      }

      let fixedCount = 0;
      for (const profile of inconsistentProfiles) {
        const success = await cleanupUserData(profile.user_id);
        if (success) fixedCount++;
      }

      showToast({
        title: "Success",
        description: `Fixed ${fixedCount} out of ${inconsistentProfiles.length} inconsistent profiles`,
      });

    } catch (error) {
      console.error('Error during bulk cleanup:', error);
      showToast({
        title: "Error",
        description: "Failed to cleanup inconsistent data",
        variant: "destructive",
      });
    }
  };

  const forceCleanupCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        showToast({
          title: "Error",
          description: "User not authenticated",
          variant: "destructive",
        });
        return false;
      }

      console.log('🧹 Force cleaning up data for current user:', user.id);
      
      const { error } = await supabase.rpc('cleanup_user_organization_data', {
        target_user_id: user.id
      });

      if (error) {
        console.error('Error during force cleanup:', error);
        showToast({
          title: "Error",
          description: "Failed to cleanup user data",
          variant: "destructive",
        });
        return false;
      }

      showToast({
        title: "Success",
        description: "User data cleaned up successfully",
      });
      return true;

    } catch (error) {
      console.error('Error during force cleanup:', error);
      showToast({
        title: "Error",
        description: "Failed to cleanup user data",
        variant: "destructive",
      });
      return false;
    }
  };

  return {
    cleanupUserData,
    cleanupAllInconsistentData,
    forceCleanupCurrentUser
  };
};
