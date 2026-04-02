import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useCurrentUser } from '@/shared/hooks/useCurrentUser';
import { useCurrentUserEmployee } from '@/1-home/components/HomeOKRDashboard/component/SectionGreetingsImport/useCurrentUserEmployee';
import { useToast } from '@/shared/components/ui/use-toast';

export interface CashAdvanceFormData {
  requestTitle: string;
  advanceType: string;
  amountIdr: string;
  expectedReturnDate: string;
  purpose: string;
  businessJustification: string;
  repaymentMethod: string;
  urgencyLevel?: string;
  projectName?: string;
  expectedExpenses?: string;
  bankAccountNumber: string;
  bankAccountName: string;
  bankName: string;
}

// Partial type for form values that might have missing required fields
export interface PartialCashAdvanceFormData {
  requestTitle?: string;
  advanceType?: string;
  amountIdr?: string;
  expectedReturnDate?: string;
  purpose?: string;
  businessJustification?: string;
  repaymentMethod?: string;
  urgencyLevel?: string;
  projectName?: string;
  expectedExpenses?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  bankName?: string;
}

export const useCreateCashAdvanceRequest = () => {
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
      formData: CashAdvanceFormData; 
      files: File[];
      isDraft?: boolean;
    }) => {
      if (!organizationId || !user) {
        throw new Error('Organization or user not found');
      }

      const cashAdvanceRequestData = {
        organization_id: organizationId,
        requester_id: user.id,
        requester_name: currentEmployee?.profile_name || user.email || 'Unknown',
        department_name: currentEmployee?.department_name || null,
        request_type: 'cash_advance',
        purchase_type: formData.advanceType, // Using purchase_type field for advance type
        request_title: formData.requestTitle,
        amount_idr: parseFloat(formData.amountIdr || '0'),
        description: formData.purpose,
        company_benefit: formData.businessJustification,
        business_purpose: formData.expectedExpenses || null,
        expected_outcome: `Expected return date: ${formData.expectedReturnDate}. Repayment method: ${formData.repaymentMethod}`,
        vendor_name: formData.projectName || null, // Using vendor_name for project name
        productivity_impact: formData.urgencyLevel || null, // Using productivity_impact for urgency level
        bank_account_number: formData.bankAccountNumber,
        bank_account_name: formData.bankAccountName,
        bank_name: formData.bankName,
        status: isDraft ? 'draft' : 'submitted',
        submitted_at: isDraft ? null : new Date().toISOString(),
        created_by: user.id,
      };

      const { data: cashAdvanceRequest, error: requestError } = await supabase
        .from('purchase_requests')
        .insert(cashAdvanceRequestData)
        .select()
        .single();

      if (requestError) throw requestError;

      // Upload files if any
      if (files.length > 0) {
        const uploadPromises = files.map(async (file) => {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
          const filePath = `${organizationId}/${cashAdvanceRequest.id}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('purchase-documents')
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          const { error: docError } = await supabase
            .from('purchase_request_documents')
            .insert({
              purchase_request_id: cashAdvanceRequest.id,
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

      return cashAdvanceRequest;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-requests'] });
      
      if (variables.isDraft) {
        toast({
          title: "Draft Saved",
          description: "Your cash advance request has been saved as draft.",
        });
      } else {
        toast({
          title: "Cash Advance Submitted",
          description: "Your cash advance request has been submitted successfully.",
        });
      }
    },
    onError: (error) => {
      console.error('Cash advance request error:', error);
      toast({
        title: "Error",
        description: "Failed to submit cash advance request. Please try again.",
        variant: "destructive",
      });
    },
  });
};
