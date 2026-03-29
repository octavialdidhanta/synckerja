import { supabase } from '@/shared/lib/supabaseClient';

export const hasOfficeLocations = async (organizationId: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('office_locations')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .limit(1);

    if (error) {
      console.error('Error checking office locations:', error);
      return false;
    }

    return data && data.length > 0;
  } catch (error) {
    console.error('Error in hasOfficeLocations:', error);
    return false;
  }
};

