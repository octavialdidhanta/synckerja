
import { useState, useCallback } from 'react';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { toast } from 'sonner';

export const useMasterData = (tableName: string) => {
  const [loading, setLoading] = useState(false);
  const { organizationId } = useCurrentOrg();

  // Stable fetch function using useCallback
  const fetchData = useCallback(async () => {
    if (!organizationId) return [];
    
    try {
      // Fetch both default items (organization_id is null) and organization-specific items
      const { data, error } = await (supabase as any)
        .from(tableName)
        .select('*')
        .eq('is_active', true)
        .or(`organization_id.eq.${organizationId},organization_id.is.null`)
        .order('name');

      if (error) {
        console.error(`Query error for ${tableName}:`, error);
        throw error;
      }
      return data || [];
    } catch (error: any) {
      console.error(`Error fetching ${tableName}:`, error);
      // More detailed error logging
      if (error.code === '22P02') {
        console.error('UUID parsing error - organizationId:', organizationId);
      }
      toast.error(`Failed to load ${tableName}`);
      return [];
    }
  }, [tableName, organizationId]);

  const addData = useCallback(async (name: string, customData?: any) => {
    if (!organizationId) {
      toast.error('Organization not found');
      return false;
    }

    setLoading(true);
    try {
      // Ensure we only send serializable data
      const safeCustomData = customData ? JSON.parse(JSON.stringify(customData)) : {};
      
      const insertData = {
        name: String(name), // Ensure name is a string
        organization_id: organizationId,
        is_active: true,
        ...safeCustomData
      };

      const { error } = await (supabase as any)
        .from(tableName)
        .insert([insertData]);

      if (error) throw error;
      
      toast.success(`${name} added successfully`);
      return true;
    } catch (error) {
      console.error(`Error adding ${tableName}:`, error);
      toast.error(`Failed to add ${name}`);
      return false;
    } finally {
      setLoading(false);
    }
  }, [tableName, organizationId]);

  const updateData = useCallback(async (id: string, name: string, customData?: any) => {
    setLoading(true);
    try {
      const updateData = {
        name,
        updated_at: new Date().toISOString(),
        ...customData
      };

      const { error } = await (supabase as any)
        .from(tableName)
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
      
      toast.success(`${name} updated successfully`);
      return true;
    } catch (error) {
      console.error(`Error updating ${tableName}:`, error);
      toast.error(`Failed to update ${name}`);
      return false;
    } finally {
      setLoading(false);
    }
  }, [tableName]);

  const deleteData = useCallback(async (id: string, name: string) => {
    setLoading(true);
    try {
      const { error } = await (supabase as any)
        .from(tableName)
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast.success(`${name} deleted successfully`);
      return true;
    } catch (error) {
      console.error(`Error deleting ${tableName}:`, error);
      toast.error(`Failed to delete ${name}`);
      return false;
    } finally {
      setLoading(false);
    }
  }, [tableName]);

  return {
    loading,
    fetchData,
    addData,
    updateData,
    deleteData
  };
};
