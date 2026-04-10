import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ClientLocation {
  id: string;
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  organization_id: string;
  is_client_location: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  notes?: string;
  client_id?: string;
  planned_start_time?: string;
  planned_end_time?: string;
  sales_person_id?: string;
  clients?: {
    id: string;
    company_name: string;
    contact_person?: string;
    contact_phone?: string;
  };
}

export const useClientLocations = () => {
  const [clientLocations, setClientLocations] = useState<ClientLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClientLocations = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError("User not authenticated");
        return;
      }

      // Get user's active organization
      const { data: profile } = await supabase
        .from('profiles')
        .select('active_organization_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.active_organization_id) {
        setError("No active organization found");
        return;
      }

      // Get employee data for current user
      const { data: employee } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', user.id)
        .eq('organization_id', profile.active_organization_id)
        .single();

      if (!employee) {
        setError("Employee data not found");
        return;
      }

      // Get client locations where is_client_location = true and assigned to current employee
      const { data: locations, error: locationsError } = await supabase
        .from('office_locations')
        .select(`
          *,
          clients (
            id,
            company_name,
            contact_person,
            contact_phone
          )
        `)
        .eq('organization_id', profile.active_organization_id)
        .eq('is_client_location', true)
        .eq('is_active', true)
        .eq('sales_person_id', employee.id)
        .order('name', { ascending: true });

      if (locationsError) {
        console.error('Error fetching client locations:', locationsError);
        setError("Failed to fetch client locations");
        return;
      }

      setClientLocations(locations || []);

    } catch (err) {
      console.error('Error in fetchClientLocations:', err);
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientLocations();
  }, []);

  return {
    clientLocations,
    loading,
    error,
    refetch: fetchClientLocations
  };
};