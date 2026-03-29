
import { supabase } from '@/shared/lib/supabaseClient';
import { getCurrentOrganizationId } from '../useCurrentOrg';
import { Branch } from './branchTypes';

export interface BranchFormData {
  name: string;
  code?: string;
  address?: string;
}

export const createBranch = async (data: BranchFormData): Promise<Branch> => {
  const { organizationId } = await getCurrentOrganizationId();
  
  const { data: branch, error } = await supabase
    .from('branches')
    .insert({
      ...data,
      organization_id: organizationId,
    })
    .select()
    .single();

  if (error) throw error;
  return branch;
};

export const updateBranch = async (id: string, data: Partial<BranchFormData>): Promise<Branch> => {
  const { data: branch, error } = await supabase
    .from('branches')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return branch;
};

export const deleteBranch = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('branches')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

export const fetchBranches = async (): Promise<Branch[]> => {
  const { organizationId } = await getCurrentOrganizationId();
  
  const { data: branches, error } = await supabase
    .from('branches')
    .select('*')
    .or(`organization_id.eq.${organizationId},organization_id.is.null`)
    .eq('is_active', true)
    .order('name');

  if (error) throw error;
  return branches || [];
};

export const buildBranchQueryKey = (id?: string) => {
  return id ? ['branches', id] : ['branches'];
};
