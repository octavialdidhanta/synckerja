import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Upload, FileText, X, User, Building2, DollarSign, Calendar } from 'lucide-react';
import { useCurrentUserEmployee } from '@/1-home/components/HomeOKRDashboard/component/SectionGreetingsImport/useCurrentUserEmployee';
import {
  useCreateCashAdvanceRequest,
  type CashAdvanceFormData as HookCashAdvanceFormData,
  type PartialCashAdvanceFormData,
} from '@/9-request-form/hooks/useCashAdvanceRequests';
import { toast } from '@/shared/components/ui/use-toast';

const cashAdvanceSchema = z.object({
  requestTitle: z.string().min(1, 'Request title is required'),
  advanceType: z.string().min(1, 'Advance type is required'),
  amountIdr: z.string().min(1, 'Amount is required'),
  expectedReturnDate: z.string().min(1, 'Expected return date is required'),
  purpose: z.string().min(1, 'Purpose is required'),
  businessJustification: z.string().min(1, 'Business justification is required'),
  repaymentMethod: z.string().min(1, 'Repayment method is required'),
  urgencyLevel: z.string().optional(),
  projectName: z.string().optional(),
  expectedExpenses: z.string().optional(),
  bankAccountNumber: z.string().min(1, 'Bank account number is required'),
  bankAccountName: z.string().min(1, 'Bank account holder name is required'),
  bankName: z.string().min(1, 'Bank name is required'),
});

type CashAdvanceFormData = z.infer<typeof cashAdvanceSchema>;

const CashAdvanceRequestForm = () => {
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const { data: currentEmployee } = useCurrentUserEmployee();
  const createCashAdvanceRequest = useCreateCashAdvanceRequest();

  const form = useForm<CashAdvanceFormData>({
    resolver: zodResolver(cashAdvanceSchema),
    defaultValues: {
      requestTitle: '',
      advanceType: '',
      amountIdr: '',
      expectedReturnDate: '',
      purpose: '',
      businessJustification: '',
      repaymentMethod: 'salary_deduction',
      urgencyLevel: 'normal',
      projectName: '',
      expectedExpenses: '',
      bankAccountNumber: '',
      bankAccountName: '',
      bankName: '',
    },
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setUploadedFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (data: CashAdvanceFormData) => {
    try {
      // Convert to HookCashAdvanceFormData format
      const hookData: HookCashAdvanceFormData = {
        requestTitle: data.requestTitle,
        advanceType: data.advanceType,
        amountIdr: data.amountIdr,
        expectedReturnDate: data.expectedReturnDate,
        purpose: data.purpose,
        businessJustification: data.businessJustification,
        repaymentMethod: data.repaymentMethod,
        urgencyLevel: data.urgencyLevel,
        projectName: data.projectName,
        expectedExpenses: data.expectedExpenses,
        bankAccountNumber: data.bankAccountNumber,
        bankAccountName: data.bankAccountName,
        bankName: data.bankName,
      };

      await createCashAdvanceRequest.mutateAsync({
        formData: hookData,
        files: uploadedFiles,
        isDraft: false,
      });
      
      toast({
        title: "Cash Advance Submitted Successfully!",
        description: "Your cash advance request has been submitted and is now pending approval.",
        variant: "default",
      });
      
      form.reset();
      setUploadedFiles([]);
    } catch (error) {
      toast({
        title: "Submission Failed",
        description: "Failed to submit cash advance request. Please try again.",
        variant: "destructive",
      });
    }
  };

  const onSaveDraft = async () => {
    try {
      const formData: PartialCashAdvanceFormData = form.getValues();
      
      // Ensure required fields have default values for draft
      const draftData: HookCashAdvanceFormData = {
        requestTitle: formData.requestTitle || 'Draft Cash Advance Request',
        advanceType: formData.advanceType || 'Other',
        amountIdr: formData.amountIdr || '0',
        expectedReturnDate: formData.expectedReturnDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        purpose: formData.purpose || 'Draft purpose',
        businessJustification: formData.businessJustification || 'Draft justification',
        repaymentMethod: formData.repaymentMethod || 'salary_deduction',
        urgencyLevel: formData.urgencyLevel,
        projectName: formData.projectName,
        expectedExpenses: formData.expectedExpenses,
        bankAccountNumber: formData.bankAccountNumber || '',
        bankAccountName: formData.bankAccountName || '',
        bankName: formData.bankName || '',
      };
      
      await createCashAdvanceRequest.mutateAsync({
        formData: draftData,
        files: uploadedFiles,
        isDraft: true,
      });
      
      toast({
        title: "Draft Saved",
        description: "Your cash advance request has been saved as draft.",
        variant: "default",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save draft. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-w-0 max-w-full space-y-2 p-3">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
          {/* Requester Information */}
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Requester Information
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <User className="h-4 w-4" />
                    Employee Name
                  </div>
                  <div className="bg-gray-50 px-3 py-2 rounded-md text-sm text-gray-600">
                    {currentEmployee?.profile_name || 'Unknown'}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <Building2 className="h-4 w-4" />
                    Department
                  </div>
                  <div className="bg-gray-50 px-3 py-2 rounded-md text-sm text-gray-600">
                    {currentEmployee?.department_name || 'No Department Assigned'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cash Advance Details */}
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                Cash Advance Details
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="requestTitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">
                        Request Title *
                      </FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Enter request title"
                          className="h-9"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="advanceType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">
                        Advance Type *
                      </FormLabel>
                      <Select name={field.name} onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-9" name={field.name}>
                            <SelectValue placeholder="Select advance type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Travel">Travel Expenses</SelectItem>
                          <SelectItem value="Project">Project Expenses</SelectItem>
                          <SelectItem value="Emergency">Emergency</SelectItem>
                          <SelectItem value="Office">Office Supplies</SelectItem>
                          <SelectItem value="Client">Client Related</SelectItem>
                          <SelectItem value="Training">Training & Education</SelectItem>
                          <SelectItem value="Equipment">Equipment Purchase</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="amountIdr"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">
                        Advance Amount (IDR) *
                      </FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="0"
                          type="number"
                          className="h-9"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="expectedReturnDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">
                        Expected Return Date *
                      </FormLabel>
                      <FormControl>
                        <Input 
                          type="date"
                          className="h-9"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="urgencyLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">
                        Urgency Level
                      </FormLabel>
                      <Select name={field.name} onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-9" name={field.name}>
                            <SelectValue placeholder="Select urgency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="purpose"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">
                      Purpose of Cash Advance *
                    </FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Explain the purpose and how the cash advance will be used..."
                        className="min-h-[80px] resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="businessJustification"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">
                      Business Justification *
                    </FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Explain how this cash advance benefits the company..."
                        className="min-h-[80px] resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Repayment & Additional Details */}
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Repayment & Additional Details
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="repaymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">
                        Repayment Method *
                      </FormLabel>
                      <Select name={field.name} onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-9" name={field.name}>
                            <SelectValue placeholder="Select repayment method" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="salary_deduction">Salary Deduction</SelectItem>
                          <SelectItem value="cash_return">Cash Return</SelectItem>
                          <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                          <SelectItem value="expense_claim">Expense Claim Settlement</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="projectName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">
                        Project Name (if applicable)
                      </FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Enter project name"
                          className="h-9"
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="expectedExpenses"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">
                      Expected Expense Breakdown
                    </FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Provide breakdown of expected expenses (optional but recommended)..."
                        className="min-h-[70px] resize-none"
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Bank Account Information */}
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Bank Account Information
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="bankAccountNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">
                        Bank Account Number *
                      </FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Enter bank account number"
                          className="h-9"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bankAccountName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">
                        Account Holder Name *
                      </FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Enter account holder name"
                          className="h-9"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="bankName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">
                      Bank Name *
                    </FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter bank name (e.g., Bank Mandiri, BCA, BRI)"
                        className="h-9"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* File Upload */}
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-foreground">
                Supporting Documents
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                <div className="text-center">
                  <Upload className="mx-auto h-12 w-12 text-gray-400" />
                  <div className="mt-4">
                    <label htmlFor="cash-advance-file-upload" className="cursor-pointer">
                      <span className="mt-2 block text-sm font-medium text-gray-900">
                        Upload supporting documents
                      </span>
                      <span className="mt-1 block text-sm text-gray-500">
                        Project proposal, budget estimate, or other relevant documents
                      </span>
                    </label>
                    <input
                      id="cash-advance-file-upload"
                      name="cash_advance_documents"
                      type="file"
                      className="sr-only"
                      multiple
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      onChange={handleFileUpload}
                    />
                  </div>
                  <Button type="button" variant="outline" className="mt-3">
                    Choose Files
                  </Button>
                </div>
              </div>

              {uploadedFiles.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-900">Uploaded Files:</h4>
                  {uploadedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                      <div className="flex items-center space-x-2">
                        <FileText className="h-4 w-4 text-gray-500" />
                        <span className="text-sm text-gray-700">{file.name}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button 
              type="submit" 
              className="flex-1"
              disabled={createCashAdvanceRequest.isPending}
            >
              {createCashAdvanceRequest.isPending ? 'Submitting...' : 'Submit Request'}
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              onClick={onSaveDraft}
              disabled={createCashAdvanceRequest.isPending}
            >
              Save Draft
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default CashAdvanceRequestForm;
