import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useCurrentUser } from '@/shared/hooks/useCurrentUser';
import { useCurrentUserEmployee } from '@/1-home/components/HomeOKRDashboard/component/SectionGreetingsImport/useCurrentUserEmployee';
import { useToast } from '@/shared/components/ui/use-toast';

export interface LoanRequestFormData {
  requestTitle?: string;
  amountIdr?: string;
  isRecurring?: boolean;
  recurringFrequency?: string;
  description?: string;
  businessPurpose?: string;
  expectedOutcome?: string;
  repaymentPlan?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  bankName?: string;
}

export const useCreateLoanRequest = () => {
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
      formData: LoanRequestFormData; 
      files: File[];
      isDraft?: boolean;
    }) => {
      if (!organizationId || !user) {
        throw new Error('Organization or user not found');
      }

      const loanRequestData = {
        organization_id: organizationId,
        requester_id: user.id,
        requester_name: currentEmployee?.profile_name || user.email || 'Unknown',
        department_name: currentEmployee?.department_name || null,
        request_type: 'loan', // Set request type to loan
        request_title: formData.requestTitle,
        amount_idr: parseFloat(formData.amountIdr || '0'),
        is_recurring: formData.isRecurring,
        recurring_frequency: formData.recurringFrequency || null,
        description: formData.description,
        company_benefit: formData.businessPurpose, // Map business purpose to company_benefit field
        expected_outcome: formData.expectedOutcome || null,
        business_purpose: formData.repaymentPlan, // Map repayment plan to business_purpose field
        bank_account_number: formData.bankAccountNumber,
        bank_account_name: formData.bankAccountName,
        bank_name: formData.bankName,
        status: isDraft ? 'draft' : 'submitted',
        submitted_at: isDraft ? null : new Date().toISOString(),
        created_by: user.id,
      };

      const { data: loanRequest, error: requestError } = await supabase
        .from('purchase_requests')
        .insert(loanRequestData)
        .select()
        .single();

      if (requestError) throw requestError;

      // Upload files if any
      if (files.length > 0) {
        const uploadPromises = files.map(async (file) => {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
          const filePath = `${organizationId}/${loanRequest.id}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('purchase-documents')
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          const { error: docError } = await supabase
            .from('purchase_request_documents')
            .insert({
              purchase_request_id: loanRequest.id,
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

      return loanRequest;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requests'] });
      
      if (variables.isDraft) {
        toast({
          title: "Draft Saved",
          description: "Your loan request has been saved as draft.",
        });
      } else {
        toast({
          title: "Loan Request Submitted",
          description: "Your loan request has been submitted successfully.",
        });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit loan request. Please try again.",
        variant: "destructive",
      });
    },
  });
};
