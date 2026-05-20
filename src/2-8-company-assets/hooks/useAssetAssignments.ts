import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { storageUploadOptions } from '@/shared/lib/storageCacheControl';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useCurrentUser } from '@/shared/hooks/useCurrentUser';

export type HandoverType = 'initial_assignment' | 'transfer' | 'resignation' | 'return';

export interface AssetAssignmentRow {
  id: string;
  asset_id: string;
  organization_id: string;
  employee_id: string | null;
  assigned_at: string;
  ended_at: string | null;
  assigned_by: string;
  document_path: string | null;
  handover_type: HandoverType;
  notes: string | null;
  created_at: string;
  updated_at: string;
  employee_full_name?: string | null;
  employee_department_name?: string | null;
}

const BUCKET = 'employee-documents';
const PREFIX = 'asset-handover';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];

export function useAssetAssignments(assetId: string | null) {
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();

  const query = useQuery({
    queryKey: ['asset-assignments', assetId],
    queryFn: async (): Promise<AssetAssignmentRow[]> => {
      if (!assetId || !organizationId) return [];
      const { data: rows, error } = await supabase
        .from('asset_assignments')
        .select('*')
        .eq('asset_id', assetId)
        .eq('organization_id', organizationId)
        .order('assigned_at', { ascending: false });

      if (error) throw error;
      if (!rows?.length) return [];

      const employeeIds = [...new Set(rows.map((r) => r.employee_id).filter(Boolean))] as string[];
      let empMap: Record<string, { full_name: string; department_id: string | null }> = {};
      let deptMap: Record<string, string> = {};
      if (employeeIds.length > 0) {
        const { data: emps } = await supabase
          .from('employees')
          .select('id, full_name, department_id')
          .in('id', employeeIds);
        empMap = (emps || []).reduce((acc, e) => ({ ...acc, [e.id]: { full_name: e.full_name, department_id: e.department_id ?? null } }), {});
        const deptIds = [...new Set((emps || []).map((e) => e.department_id).filter(Boolean))] as string[];
        if (deptIds.length > 0) {
          const { data: depts } = await supabase.from('departments').select('id, name').in('id', deptIds);
          deptMap = (depts || []).reduce((acc, d) => ({ ...acc, [d.id]: d.name }), {});
        }
      }

      return rows.map((r) => {
        const emp = r.employee_id ? empMap[r.employee_id] : null;
        const deptName = emp?.department_id ? deptMap[emp.department_id] ?? null : null;
        return {
          ...r,
          employee_full_name: emp?.full_name ?? null,
          employee_department_name: deptName,
        } as AssetAssignmentRow;
      });
    },
    enabled: !!assetId && !!organizationId,
  });

  return { assignments: query.data ?? [], isLoading: query.isLoading, refetch: query.refetch };
}

export function useCreateAssetAssignment() {
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async (params: {
      assetId: string;
      employeeId: string | null;
      handoverType: HandoverType;
      file: File;
      notes?: string;
    }) => {
      if (!organizationId || !user) throw new Error('Not authenticated');
      if (!params.file) throw new Error('Document is required');
      if (params.file.size > MAX_FILE_SIZE) throw new Error('File size must be less than 10MB');
      if (!ALLOWED_TYPES.includes(params.file.type)) throw new Error('Allowed: PDF, JPG, PNG');

      const path = `${PREFIX}/${organizationId}/${params.assetId}/${Date.now()}-${params.file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, params.file, storageUploadOptions({ upsert: false, contentType: params.file.type }));
      if (uploadError) throw uploadError;

      const { data: row, error } = await supabase
        .from('asset_assignments')
        .insert({
          asset_id: params.assetId,
          organization_id: organizationId,
          employee_id: params.employeeId,
          assigned_at: new Date().toISOString(),
          ended_at: null,
          assigned_by: user.id,
          document_path: path,
          handover_type: params.handoverType,
          notes: params.notes ?? null,
        })
        .select()
        .single();

      if (error) throw error;
      return row;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['asset-assignments', variables.assetId] });
      queryClient.invalidateQueries({ queryKey: ['company-assets'] });
    },
  });
}

export function useAssignAsset() {
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async (params: { assetId: string; employeeId: string; file: File; notes?: string }) => {
      if (!organizationId || !user) throw new Error('Not authenticated');
      if (!params.file) throw new Error('Document is required');
      if (params.file.size > MAX_FILE_SIZE) throw new Error('File size must be less than 10MB');
      if (!ALLOWED_TYPES.includes(params.file.type)) throw new Error('Allowed: PDF, JPG, PNG');

      const path = `${PREFIX}/${organizationId}/${params.assetId}/${Date.now()}-${params.file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, params.file, storageUploadOptions({ upsert: false, contentType: params.file.type }));
      if (uploadError) throw uploadError;

      await supabase.from('asset_assignments').insert({
        asset_id: params.assetId,
        organization_id: organizationId,
        employee_id: params.employeeId,
        assigned_at: new Date().toISOString(),
        ended_at: null,
        assigned_by: user.id,
        document_path: path,
        handover_type: 'initial_assignment',
        notes: params.notes ?? null,
      });

      const { error: updateError } = await supabase
        .from('company_assets')
        .update({
          status: 'in-use',
          assigned_to_employee_id: params.employeeId,
          assigned_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.assetId);

      if (updateError) throw updateError;
      return params.assetId;
    },
    onSuccess: (assetId) => {
      queryClient.invalidateQueries({ queryKey: ['asset-assignments', assetId] });
      queryClient.invalidateQueries({ queryKey: ['company-assets'] });
    },
  });
}

export function useHandoverAsset() {
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async (params: {
      assetId: string;
      newEmployeeId: string | null;
      handoverType: 'transfer' | 'resignation';
      file: File;
      notes?: string;
    }) => {
      if (!organizationId || !user) throw new Error('Not authenticated');
      if (!params.file) throw new Error('Document is required');
      if (params.file.size > MAX_FILE_SIZE) throw new Error('File size must be less than 10MB');
      if (!ALLOWED_TYPES.includes(params.file.type)) throw new Error('Allowed: PDF, JPG, PNG');

      const path = `${PREFIX}/${organizationId}/${params.assetId}/${Date.now()}-${params.file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, params.file, storageUploadOptions({ upsert: false, contentType: params.file.type }));
      if (uploadError) throw uploadError;

      const { data: currentRows } = await supabase
        .from('asset_assignments')
        .select('id')
        .eq('asset_id', params.assetId)
        .is('ended_at', null);

      if (currentRows?.length) {
        await supabase
          .from('asset_assignments')
          .update({ ended_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .in('id', currentRows.map((r) => r.id));
      }

      const isResignationReturnToCompany = params.handoverType === 'resignation' && !params.newEmployeeId;

      if (isResignationReturnToCompany) {
        await supabase.from('asset_assignments').insert({
          asset_id: params.assetId,
          organization_id: organizationId,
          employee_id: null,
          assigned_at: new Date().toISOString(),
          ended_at: new Date().toISOString(),
          assigned_by: user.id,
          document_path: path,
          handover_type: 'return',
          notes: params.notes ?? null,
        });
        const { error: updateError } = await supabase
          .from('company_assets')
          .update({
            status: 'available',
            assigned_to_employee_id: null,
            assigned_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', params.assetId);
        if (updateError) throw updateError;
        return params.assetId;
      }

      if (!params.newEmployeeId) throw new Error('Select new employee for transfer');
      await supabase.from('asset_assignments').insert({
        asset_id: params.assetId,
        organization_id: organizationId,
        employee_id: params.newEmployeeId,
        assigned_at: new Date().toISOString(),
        ended_at: null,
        assigned_by: user.id,
        document_path: path,
        handover_type: params.handoverType,
        notes: params.notes ?? null,
      });
      const { error: updateError } = await supabase
        .from('company_assets')
        .update({
          assigned_to_employee_id: params.newEmployeeId,
          assigned_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.assetId);
      if (updateError) throw updateError;
      return params.assetId;
    },
    onSuccess: (assetId) => {
      queryClient.invalidateQueries({ queryKey: ['asset-assignments', assetId] });
      queryClient.invalidateQueries({ queryKey: ['company-assets'] });
    },
  });
}

export function useReturnAsset() {
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async (params: { assetId: string; file?: File | null; notes?: string; documentOptional?: boolean }) => {
      if (!organizationId || !user) throw new Error('Not authenticated');
      const optional = params.documentOptional === true;
      if (!optional && !params.file) throw new Error('Return document is required');
      if (params.file) {
        if (params.file.size > MAX_FILE_SIZE) throw new Error('File size must be less than 10MB');
        if (!ALLOWED_TYPES.includes(params.file.type)) throw new Error('Allowed: PDF, JPG, PNG');
      }

      let path: string | null = null;
      if (params.file) {
        path = `${PREFIX}/${organizationId}/${params.assetId}/${Date.now()}-${params.file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, params.file, storageUploadOptions({ upsert: false, contentType: params.file.type }));
        if (uploadError) throw uploadError;
      }

      const { data: currentRows } = await supabase
        .from('asset_assignments')
        .select('id')
        .eq('asset_id', params.assetId)
        .is('ended_at', null);

      if (currentRows?.length) {
        await supabase
          .from('asset_assignments')
          .update({ ended_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .in('id', currentRows.map((r) => r.id));
      }

      await supabase.from('asset_assignments').insert({
        asset_id: params.assetId,
        organization_id: organizationId,
        employee_id: null,
        assigned_at: new Date().toISOString(),
        ended_at: new Date().toISOString(),
        assigned_by: user.id,
        document_path: path,
        handover_type: 'return',
        notes: params.notes ?? null,
      });

      const { error: updateError } = await supabase
        .from('company_assets')
        .update({
          status: 'available',
          assigned_to_employee_id: null,
          assigned_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.assetId);

      if (updateError) throw updateError;
      return params.assetId;
    },
    onSuccess: (assetId) => {
      queryClient.invalidateQueries({ queryKey: ['asset-assignments', assetId] });
      queryClient.invalidateQueries({ queryKey: ['company-assets'] });
    },
  });
}
