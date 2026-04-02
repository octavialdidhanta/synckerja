import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/hooks/useCurrentOrg';
import { useCurrentUser } from '@/shared/hooks/useCurrentUser';
import { useCurrentUserEmployee } from '@/1-home/components/HomeOKRDashboard/component/SectionGreetingsImport/useCurrentUserEmployee';
import { useToast } from '@/shared/components/ui/use-toast';

export interface PurchaseRequestFormData {
  purchaseType?: string;
  requestTitle?: string;
  amountIdr?: string;
  quantity?: number | string;
  isRecurring?: boolean;
  recurringFrequency?: string;
  description?: string;
  companyBenefit?: string;
  productivityImpact?: string;
  efficiencyImpact?: string;
  expectedOutcome?: string;
  vendorName?: string;
  purchaseLink?: string;
  accountUsername?: string;
  accountPassword?: string;
}

export interface PurchaseRequest {
  id: string;
  organization_id: string;
  requester_id: string;
  requester_name: string;
  department_name?: string;
  request_type?: string; 
  purchase_type?: string; // Made optional for reimbursement compatibility
  reimbursement_type?: string;
  request_title: string;
  amount_idr: number;
  quantity?: number;
  is_recurring?: boolean;
  recurring_frequency?: string;
  expense_date?: string;
  original_receipt_amount?: string; // Keep as string to match database
  description: string;
  company_benefit: string;
  productivity_impact?: string;
  efficiency_impact?: string;
  expected_outcome?: string;
  vendor_name?: string;
  merchant_name?: string;
  receipt_number?: string;
  purchase_link?: string;
  account_username?: string;
  account_password?: string;
  exchange_rate?: string; // Keep as string to match database
  business_purpose?: string;
  advance_request_id?: string;
  bank_account_number?: string;
  bank_account_name?: string;
  bank_name?: string;
  status: 'draft' | 'submitted' | 'pending_approval' | 'approved' | 'rejected' | 'cancelled';
  submitted_at?: string;
  approved_at?: string;
  approved_by?: string;
  rejected_at?: string;
  rejected_by?: string;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  expense_type_id?: string;
  expense_category_id?: string;
  approved_by_user_id?: string;
  rejected_by_user_id?: string;
  approval_notes?: string;
  approved_by_name?: string;
  rejected_by_name?: string;
  paid_at?: string;
  payment_status?: string;
  invoice_file_path?: string;
  paid_by_user_id?: string;
  paid_by_name?: string;
  withdrawal_from_balance?: string;
  bank_account_id?: string;
  expense_types?: {
    name: string;
    description?: string;
  } | null;
  expense_categories?: {
    name: string;
    description?: string;
  } | null;
}

export const usePurchaseRequests = () => {
  const { organizationId } = useCurrentOrg();

  return useQuery({
    queryKey: ['purchase-requests', organizationId],
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    /** Satu jaringan fetch per key org: hindari refetch kedua saat remount / Strict Mode / banyak observer. */
    refetchOnMount: false,
    staleTime: 2 * 60 * 1000, // 2 min — avoid refetch on mount when revisiting; prevents flicker
    queryFn: async () => {
      if (!organizationId) {
        return [];
      }

      try {
        const { data, error } = await supabase
          .from('purchase_requests')
          .select(`
            *,
            expense_types:expense_type_id(name, description),
            expense_categories:expense_category_id(name, description)
          `)
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: false });

        if (error) {
          throw error;
        }

        return (data || []).map(item => {
          // Handle expense_types join - could be object, array, or null
          let expenseTypes = null;
          if (item.expense_types) {
            if (Array.isArray(item.expense_types)) {
              expenseTypes = item.expense_types[0] || null;
            } else {
              expenseTypes = item.expense_types;
            }
          }
          
          // Handle expense_categories join - could be object, array, or null
          let expenseCategories = null;
          if (item.expense_categories) {
            if (Array.isArray(item.expense_categories)) {
              expenseCategories = item.expense_categories[0] || null;
            } else {
              expenseCategories = item.expense_categories;
            }
          }
          
          return {
            ...item,
            // Keep original_receipt_amount as string since database expects string
            original_receipt_amount: item.original_receipt_amount || undefined,
            // Keep exchange_rate as string since database expects string
            exchange_rate: item.exchange_rate || '1',
            expense_types: expenseTypes,
            expense_categories: expenseCategories
          } as PurchaseRequest;
        });
      } catch (error) {
        throw error;
      }
    },
    enabled: !!organizationId,
  });
};

export const useCreatePurchaseRequest = () => {
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();
  const { user } = useCurrentUser();
  const { data: currentEmployee } = useCurrentUserEmployee();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      formData, 
      files, 
      isDraft = false 
    }: { 
      formData: PurchaseRequestFormData; 
      files: File[];
      isDraft?: boolean;
    }) => {
      if (!organizationId || !user) {
        throw new Error('Organization or user not found');
      }

      // Get expense type and category IDs if purchase type is provided
      let expenseTypeId: string | null = null;
      let expenseCategoryId: string | null = null;

      if (formData.purchaseType) {
        const { data: expenseType } = await supabase
          .from('expense_types')
          .select('id')
          .eq('name', formData.purchaseType)
          .or(`organization_id.eq.${organizationId},organization_id.is.null`)
          .maybeSingle();

        if (expenseType) {
          expenseTypeId = expenseType.id;
        }
      }

      const purchaseRequestData = {
        organization_id: organizationId,
        requester_id: user.id,
        requester_name: currentEmployee?.profile_name || user.email || 'Unknown',
        department_name: currentEmployee?.department_name || null,
        request_type: 'purchase', // Explicitly set to purchase
        purchase_type: formData.purchaseType,
        request_title: formData.requestTitle,
        amount_idr: parseFloat(formData.amountIdr || '0'),
        quantity: Math.max(1, parseInt(String(formData.quantity || 1), 10) || 1),
        is_recurring: formData.isRecurring,
        recurring_frequency: formData.recurringFrequency || null,
        description: formData.description,
        company_benefit: formData.companyBenefit,
        productivity_impact: formData.productivityImpact || null,
        efficiency_impact: formData.efficiencyImpact || null,
        expected_outcome: formData.expectedOutcome || null,
        vendor_name: formData.vendorName || null,
        purchase_link: formData.purchaseLink || null,
        account_username: formData.accountUsername || null,
        account_password: formData.accountPassword || null,
        status: isDraft ? 'draft' : 'submitted',
        submitted_at: isDraft ? null : new Date().toISOString(),
        created_by: user.id,
        expense_type_id: expenseTypeId,
        expense_category_id: expenseCategoryId,
      };

      const { data: purchaseRequest, error: requestError } = await supabase
        .from('purchase_requests')
        .insert(purchaseRequestData)
        .select()
        .single();

      if (requestError) throw requestError;

      // Upload files if any
      if (files.length > 0) {
        const uploadPromises = files.map(async (file) => {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
          const filePath = `${organizationId}/${purchaseRequest.id}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('purchase-documents')
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          const { error: docError } = await supabase
            .from('purchase_request_documents')
            .insert({
              purchase_request_id: purchaseRequest.id,
              file_name: fileName,
              original_name: file.name,
              file_path: filePath,
              file_size: file.size,
              mime_type: file.type,
              uploaded_by: user.id,
            });

          if (docError) throw docError;
        });

        await Promise.all(uploadPromises);
      }

      return purchaseRequest;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requests'] });
      
      if (variables.isDraft) {
        toast({
          title: "Draft Saved",
          description: "Your purchase request has been saved as draft.",
        });
      } else {
        toast({
          title: "Request Submitted",
          description: "Your purchase request has been submitted successfully.",
        });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit purchase request. Please try again.",
        variant: "destructive",
      });
    },
  });
};

export const useUpdatePurchaseRequestStatus = () => {
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const { data: currentEmployee } = useCurrentUserEmployee();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      id, 
      status, 
      rejectionReason,
      approvalNotes,
      markAsPaid = false,
      invoiceFilePath,
      expenseTypeId,
      expenseCategoryId,
      withdrawalFromBalance,
      bankAccountId
    }: { 
      id: string; 
      status: PurchaseRequest['status'];
      rejectionReason?: string;
      approvalNotes?: string;
      markAsPaid?: boolean;
      invoiceFilePath?: string;
      expenseTypeId?: string;
      expenseCategoryId?: string;
      withdrawalFromBalance?: string;
      bankAccountId?: string;
    }) => {
      if (!user) {
        throw new Error('User not authenticated');
      }

      const updateData: any = {
        status,
        updated_at: new Date().toISOString(),
      };

      // If expense type and category are provided, update them
      if (expenseTypeId) {
        updateData.expense_type_id = expenseTypeId;
      }
      if (expenseCategoryId) {
        updateData.expense_category_id = expenseCategoryId;
      }
      if (withdrawalFromBalance !== undefined) {
        updateData.withdrawal_from_balance = withdrawalFromBalance || null;
      }
      if (bankAccountId !== undefined) {
        updateData.bank_account_id = bankAccountId || null;
      }

      // If invoice file path is provided, save it (do not auto-mark as paid; use markAsPaid for that)
      if (invoiceFilePath) {
        updateData.invoice_file_path = invoiceFilePath;
      }

      // Mark as paid only when explicitly requested (e.g. after expense is created)
      if (markAsPaid || approvalNotes?.includes('Payment processed') || approvalNotes?.includes('Marked as paid')) {
        updateData.paid_at = new Date().toISOString();
        updateData.payment_status = 'paid';
        // Save who processed the payment
        updateData.paid_by_user_id = user.id;
        updateData.paid_by_name = currentEmployee?.profile_name || user.email || 'Unknown';
      }

      if (status === 'approved') {
        updateData.approved_at = new Date().toISOString();
        updateData.approved_by_user_id = user.id;
        updateData.approved_by_name = currentEmployee?.profile_name || user.email || 'Unknown';
        if (approvalNotes) {
          updateData.approval_notes = approvalNotes;
        }
      } else if (status === 'rejected') {
        updateData.rejected_at = new Date().toISOString();
        updateData.rejected_by_user_id = user.id;
        updateData.rejected_by_name = currentEmployee?.profile_name || user.email || 'Unknown';
        updateData.rejection_reason = rejectionReason;
      }

      const { data, error } = await supabase
        .from('purchase_requests')
        .update(updateData)
        .eq('id', id)
        .select(`
          *,
          expense_types:expense_type_id(name, description),
          expense_categories:expense_category_id(name, description)
        `)
        .single();

      if (error) throw error;
      
      // Transform the response to match PurchaseRequest interface
      const transformedData = {
        ...data,
        expense_types: Array.isArray(data.expense_types) ? data.expense_types[0] || null : data.expense_types,
        expense_categories: Array.isArray(data.expense_categories) ? data.expense_categories[0] || null : data.expense_categories
      };
      
      return transformedData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requests'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update status. Please try again.",
        variant: "destructive",
      });
    },
  });
};

export const useDeletePurchaseRequest = () => {
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!organizationId) {
        throw new Error('Organization not found');
      }

      // Step 1: Verify purchase request exists and belongs to organization
      const { data: existingRequest, error: fetchError } = await supabase
        .from('purchase_requests')
        .select('id, organization_id, requester_id')
        .eq('id', id)
        .maybeSingle();

      if (fetchError) {
        throw new Error(`Failed to verify purchase request: ${fetchError.message}`);
      }

      if (!existingRequest) {
        throw new Error('Purchase request not found');
      }

      if (existingRequest.organization_id !== organizationId) {
        throw new Error('Purchase request does not belong to your organization');
      }

      // Step 2: Get all documents for this request BEFORE deleting
      const { data: documents, error: documentsError } = await supabase
        .from('purchase_request_documents')
        .select('file_path')
        .eq('purchase_request_id', id);

      let filePaths: string[] = [];
      if (!documentsError && documents && documents.length > 0) {
        filePaths = documents.map(doc => doc.file_path);
      }

      // Step 3: Delete the purchase request itself
      const { error: deleteError, data: deletedData } = await supabase
        .from('purchase_requests')
        .delete()
        .eq('id', id)
        .select();

      if (deleteError) {
        throw new Error(`Failed to delete purchase request: ${deleteError.message}`);
      }

      if (!deletedData || deletedData.length === 0) {
        throw new Error('Purchase request was not deleted. It may be blocked by security policy.');
      }

      // Step 3: Delete files from storage (if documents existed)
      if (filePaths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from('purchase-documents')
          .remove(filePaths);

        if (storageError) {
          // Don't throw - request is already deleted; files may be orphaned
        }
      }

      // Step 4: Clean up any orphaned document records (in case cascade didn't work)
      if (filePaths.length > 0) {
        await supabase
          .from('purchase_request_documents')
          .delete()
          .eq('purchase_request_id', id);
      }

      return id;
    },
    onSuccess: (deletedId) => {
      // Optimistic update - remove from cache immediately
      if (organizationId) {
        queryClient.setQueryData(
          ['purchase-requests', organizationId],
          (oldData: PurchaseRequest[] | undefined) => {
            if (!oldData) return oldData;
            // Filter out the deleted request
            const filtered = oldData.filter((request) => request.id !== deletedId);
            return filtered;
          }
        );
      }
      
      toast({
        title: "Success",
        description: "Purchase request deleted successfully.",
      });
    },
    onError: () => {
      // Revalidate queries on error to restore correct state
      queryClient.invalidateQueries({ queryKey: ['purchase-requests'] });
      toast({
        title: "Error",
        description: "Failed to delete purchase request. Please try again.",
        variant: "destructive",
      });
    },
  });
};
