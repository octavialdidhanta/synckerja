
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { logger } from '@/shared/lib/logger';

export type Profile = {
  user_id: string;
  full_name: string;
  email: string;
  active_organization_id?: string;
  department_id?: string;
  created_at: string;
  updated_at: string;
  // Extended profile fields
  phone?: string;
  bio?: string;
  job_title?: string;
  location?: string;
  website?: string;
  profile_photo_url?: string;
};

export const useProfile = () => {
  return useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error('No authenticated user');

      // Get basic profile data
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profileError) throw profileError;

      // Get extended profile data using profile_id (which references user_id from profiles)
      const { data: detailsData, error: detailsError } = await supabase
        .from('user_profile_details')
        .select('*')
        .eq('profile_id', user.id)
        .maybeSingle();

      // Get employee data to sync profile photo if needed
      const { data: employeeData } = await supabase
        .from('employees')
        .select('profile_photo_url')
        .eq('user_id', user.id)
        .maybeSingle();

      if (import.meta.env?.DEV) {
        logger.userData('🔍 useProfile - Basic profile data:', profileData);
        logger.userData('🔍 useProfile - Extended profile data:', detailsData);
        logger.userData('🔍 useProfile - Employee photo data:', employeeData);
      }

      // Use employee photo if user_profile_details doesn't have one
      const photoUrl = detailsData?.profile_photo_url || employeeData?.profile_photo_url || null;

      // Combine both datasets
      const combinedData = {
        ...profileData,
        phone: detailsData?.phone || '',
        bio: detailsData?.bio || '',
        job_title: detailsData?.job_title || '',
        location: detailsData?.location || '',
        website: detailsData?.website || '',
        profile_photo_url: photoUrl,
      };

      if (import.meta.env?.DEV) {
        logger.userData('🔍 useProfile - Final combined data:', combinedData);
      }
      return combinedData as Profile;
    },
    enabled: true,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 1,
  });
};
