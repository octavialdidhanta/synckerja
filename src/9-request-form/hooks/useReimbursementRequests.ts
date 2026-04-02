import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/hooks/useCurrentOrg";
import { useCurrentUser } from "@/shared/hooks/useCurrentUser";
import { useCurrentUserEmployee } from "@/1-home/components/HomeOKRDashboard/component/SectionGreetingsImport/useCurrentUserEmployee";
import { useToast } from "@/shared/components/ui/use-toast";
import type { ReimbursementFormData } from "@/shared/lib/reimbursementRequestTypes";

export const useCreateReimbursementRequest = () => {
  const queryClient = useQueryClient();
  const { organizationId } = useCurrentOrg();
  const { user } = useCurrentUser();
  const { data: currentEmployee } = useCurrentUserEmployee();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      formData,
      files,
      isDraft = false,
    }: {
      formData: ReimbursementFormData;
      files: File[];
      isDraft?: boolean;
    }) => {
      if (!organizationId || !user) {
        throw new Error("Organization or user not found");
      }

      const reimbursementRequestData = {
        organization_id: organizationId,
        requester_id: user.id,
        requester_name: currentEmployee?.profile_name || user.email || "Unknown",
        department_name: currentEmployee?.department_name || null,
        request_type: "reimbursement",
        purchase_type: null,
        reimbursement_type: formData.reimbursementType,
        request_title: formData.requestTitle,
        amount_idr: parseFloat(formData.amountIdr || "0"),
        expense_date: formData.expenseDate,
        original_receipt_amount: formData.originalReceiptAmount || null,
        description: formData.description,
        company_benefit: formData.companyBenefit,
        productivity_impact: formData.businessPurpose || null,
        expected_outcome: formData.expectedOutcome || null,
        merchant_name: formData.merchantName || null,
        receipt_number: formData.receiptNumber || null,
        exchange_rate: formData.exchangeRate || "1",
        business_purpose: formData.businessPurpose || null,
        bank_account_number: formData.bankAccountNumber,
        bank_account_name: formData.bankAccountName,
        bank_name: formData.bankName,
        status: isDraft ? "draft" : "submitted",
        submitted_at: isDraft ? null : new Date().toISOString(),
        created_by: user.id,
      };

      const { data: reimbursementRequest, error: requestError } = await supabase
        .from("purchase_requests")
        .insert(reimbursementRequestData)
        .select()
        .single();

      if (requestError) throw requestError;

      if (files.length > 0) {
        const uploadPromises = files.map(async (file) => {
          const fileExt = file.name.split(".").pop();
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
          const filePath = `${organizationId}/${reimbursementRequest.id}/${fileName}`;

          const { error: uploadError } = await supabase.storage.from("purchase-documents").upload(filePath, file);

          if (uploadError) throw uploadError;

          const { error: docError } = await supabase.from("purchase_request_documents").insert({
            purchase_request_id: reimbursementRequest.id,
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

      return reimbursementRequest;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["purchase-requests"] });

      if (variables.isDraft) {
        toast({
          title: "Draft Saved",
          description: "Your reimbursement request has been saved as draft.",
        });
      } else {
        toast({
          title: "Reimbursement Submitted",
          description: "Your reimbursement request has been submitted successfully.",
        });
      }
    },
    onError: (error) => {
      console.error("Reimbursement request error:", error);
      toast({
        title: "Error",
        description: "Failed to submit reimbursement request. Please try again.",
        variant: "destructive",
      });
    },
  });
};
