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
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Upload, FileText, X, User, Building2, DollarSign, CheckCircle } from 'lucide-react';
import { useCurrentUserEmployee } from '@/1-home/components/HomeOKRDashboard/component/SectionGreetingsImport/useCurrentUserEmployee';
import { useCreateLoanRequest } from '@/9-request-form/hooks/useLoanRequests';
import { toast } from '@/shared/components/ui/use-toast';

const loanRequestSchema = z.object({
  requestTitle: z.string().min(1, 'Loan purpose/title is required'),
  amountIdr: z.string().min(1, 'Loan amount is required'),
  isRecurring: z.boolean().default(false),
  recurringFrequency: z.string().optional(),
  description: z.string().min(1, 'Detailed description is required'),
  businessPurpose: z.string().min(1, 'Business purpose is required'),
  expectedOutcome: z.string().optional(),
  repaymentPlan: z.string().min(1, 'Repayment plan is required'),
  bankAccountNumber: z.string().min(1, 'Bank account number is required'),
  bankAccountName: z.string().min(1, 'Bank account holder name is required'),
  bankName: z.string().min(1, 'Bank name is required'),
});

type LoanRequestFormData = z.infer<typeof loanRequestSchema>;

const LoanRequestForm = () => {
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const { data: currentEmployee } = useCurrentUserEmployee();
  const createLoanRequest = useCreateLoanRequest();

  const form = useForm<LoanRequestFormData>({
    resolver: zodResolver(loanRequestSchema),
    defaultValues: {
      isRecurring: false,
    },
  });

  const isRecurring = form.watch('isRecurring');

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setUploadedFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (data: LoanRequestFormData) => {
    try {
      await createLoanRequest.mutateAsync({
        formData: data,
        files: uploadedFiles,
        isDraft: false,
      });
      
      toast({
        title: "Loan Request Submitted Successfully!",
        description: "Your loan request has been submitted and is now pending approval.",
        variant: "default",
      });
      
      form.reset();
      setUploadedFiles([]);
    } catch (error) {
      toast({
        title: "Submission Failed",
        description: "Failed to submit loan request. Please try again.",
        variant: "destructive",
      });
    }
  };

  const onSaveDraft = async () => {
    try {
      const data = form.getValues();
      await createLoanRequest.mutateAsync({
        formData: data,
        files: uploadedFiles,
        isDraft: true,
      });
      
      toast({
        title: "Draft Saved",
        description: "Your loan request has been saved as draft.",
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

          {/* Loan Details */}
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                Loan Details
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {/* Loan Purpose and Amount Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="requestTitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">
                        Loan Purpose/Title *
                      </FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., Emergency equipment purchase, Medical expenses, etc."
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
                  name="amountIdr"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">
                        Loan Amount (IDR) *
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
              </div>

              {/* Recurring and Frequency Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                <FormField
                  control={form.control}
                  name="isRecurring"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 pb-2">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          name={field.name}
                        />
                      </FormControl>
                      <FormLabel className="text-sm font-medium text-gray-700">
                        Recurring Loan (Multiple Disbursements)
                      </FormLabel>
                    </FormItem>
                  )}
                />

                {isRecurring && (
                  <FormField
                    control={form.control}
                    name="recurringFrequency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-gray-700">
                          Disbursement Frequency
                        </FormLabel>
                        <Select name={field.name} onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-9" name={field.name}>
                              <SelectValue placeholder="Select frequency" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Monthly">Monthly</SelectItem>
                            <SelectItem value="Quarterly">Quarterly</SelectItem>
                            <SelectItem value="Bi-annually">Bi-annually</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                )}
              </div>

              {/* Description */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">
                      Detailed Description *
                    </FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Provide detailed description of why you need this loan and how it will be used..."
                        className="min-h-[80px] resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Business Purpose */}
              <FormField
                control={form.control}
                name="businessPurpose"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">
                      Business Purpose & Justification *
                    </FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Explain how this loan relates to business needs and will benefit the company or your work performance..."
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

          {/* Repayment Plan */}
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-foreground">
                Repayment Plan
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <FormField
                control={form.control}
                name="repaymentPlan"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">
                      Proposed Repayment Plan *
                    </FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Describe your proposed repayment schedule (e.g., monthly deductions from salary over 12 months, lump sum payment by specific date, etc.)"
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
                name="expectedOutcome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">
                      Expected Outcome/Impact
                    </FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="What positive outcomes do you expect from this loan? How will it help resolve your situation or improve performance?"
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

          {/* Supporting Documents */}
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-foreground">
                Supporting Documents
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-gray-400 transition-colors">
                  <input
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                    id="loan-request-file-upload"
                    name="loan_request_documents"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx,.xls"
                  />
                  <label htmlFor="loan-request-file-upload" className="cursor-pointer">
                    <Upload className="h-6 w-6 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-xs text-gray-500">
                      Medical bills, quotes, supporting documents (PDF, DOC, JPG, PNG, XLSX - max 10MB each)
                    </p>
                  </label>
                </div>

                {uploadedFiles.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">Uploaded Files:</p>
                    {uploadedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <FileText className="h-4 w-4 text-gray-500" />
                          <span className="text-sm text-gray-700">{file.name}</span>
                          <span className="text-xs text-gray-500">
                            ({(file.size / 1024 / 1024).toFixed(2)} MB)
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                          className="text-red-500 hover:text-red-700 h-6 w-6 p-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Submit Section */}
          <div className="flex justify-end space-x-3 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              className="px-6"
              onClick={onSaveDraft}
              disabled={createLoanRequest.isPending}
            >
              Save as Draft
            </Button>
            <Button 
              type="submit" 
              className="px-6 bg-primary hover:bg-primary/90 flex items-center gap-2"
              disabled={createLoanRequest.isPending}
            >
              {createLoanRequest.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Submit Loan Request
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default LoanRequestForm;
