
export interface ReimbursementFormData {
  requestTitle: string;
  reimbursementType: string;
  amountIdr: string;
  expenseDate: string;
  description: string;
  companyBenefit: string;
  businessPurpose?: string;
  expectedOutcome?: string;
  merchantName?: string;
  receiptNumber?: string;
  originalReceiptAmount?: string;
  exchangeRate?: string;
  bankAccountNumber: string;
  bankAccountName: string;
  bankName: string;
}

export interface ReimbursementRequest {
  id: string;
  organization_id: string;
  requester_id: string;
  requester_name: string;
  department_name?: string;
  request_type: 'reimbursement';
  reimbursement_type: string;
  request_title: string;
  amount_idr: number;
  expense_date: string;
  original_receipt_amount?: number;
  description: string;
  company_benefit: string;
  business_purpose?: string;
  expected_outcome?: string;
  merchant_name?: string;
  receipt_number?: string;
  exchange_rate?: number;
  advance_request_id?: string;
  status: 'draft' | 'submitted' | 'pending_approval' | 'approved' | 'rejected' | 'cancelled';
  submitted_at?: string;
  approved_at?: string;
  rejected_at?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
}
