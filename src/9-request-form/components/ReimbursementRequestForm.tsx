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
import { Upload, FileText, X, User, Building2, Clipboard, CheckCircle, Receipt } from 'lucide-react';
import { useCurrentUserEmployee } from '@/1-home/components/HomeOKRDashboard/component/SectionGreetingsImport/useCurrentUserEmployee';
import { useCreateReimbursementRequest } from '@/9-request-form/hooks/useReimbursementRequests';
import { toast } from '@/shared/components/ui/use-toast';
import type { ReimbursementFormData } from '@/shared/lib/reimbursementRequestTypes';

const reimbursementSchema = z.object({
  requestTitle: z.string().min(1, 'Request title is required'),
  reimbursementType: z.string().min(1, 'Reimbursement type is required'),
  amountIdr: z.string().min(1, 'Amount is required'),
  expenseDate: z.string().min(1, 'Expense date is required'),
  description: z.string().min(1, 'Description is required'),
  companyBenefit: z.string().min(1, 'Company benefit is required'),
  businessPurpose: z.string().optional(),
  expectedOutcome: z.string().optional(),
  merchantName: z.string().optional(),
  receiptNumber: z.string().optional(),
  originalReceiptAmount: z.string().optional(),
  exchangeRate: z.string().optional(),
  bankAccountNumber: z.string().min(1, 'Bank account number is required'),
  bankAccountName: z.string().min(1, 'Bank account holder name is required'),
  bankName: z.string().min(1, 'Bank name is required'),
});

type FormData = z.infer<typeof reimbursementSchema>;

const ReimbursementRequestForm = () => {
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const { data: currentEmployee } = useCurrentUserEmployee();
  const createReimbursementRequest = useCreateReimbursementRequest();

  const form = useForm<FormData>({
    resolver: zodResolver(reimbursementSchema),
    defaultValues: {
      requestTitle: '',
      reimbursementType: '',
      amountIdr: '',
      expenseDate: '',
      description: '',
      companyBenefit: '',
      businessPurpose: '',
      expectedOutcome: '',
      merchantName: '',
      receiptNumber: '',
      originalReceiptAmount: '',
      exchangeRate: '1',
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

  const onSubmit = async (data: FormData) => {
    try {
      // Convert FormData to ReimbursementFormData - keep originalReceiptAmount as string
      const reimbursementData: ReimbursementFormData = {
        requestTitle: data.requestTitle,
        reimbursementType: data.reimbursementType,
        amountIdr: data.amountIdr,
        expenseDate: data.expenseDate,
        description: data.description,
        companyBenefit: data.companyBenefit,
        businessPurpose: data.businessPurpose,
        expectedOutcome: data.expectedOutcome,
        merchantName: data.merchantName,
        receiptNumber: data.receiptNumber,
        originalReceiptAmount: data.originalReceiptAmount, // Keep as string
        exchangeRate: data.exchangeRate,
        bankAccountNumber: data.bankAccountNumber,
        bankAccountName: data.bankAccountName,
        bankName: data.bankName,
      };

      await createReimbursementRequest.mutateAsync({
        formData: reimbursementData,
        files: uploadedFiles,
        isDraft: false,
      });
      
      toast({
        title: "Reimbursement Submitted Successfully!",
        description: "Your reimbursement request has been submitted and is now pending approval.",
        variant: "default",
      });
      
      form.reset();
      setUploadedFiles([]);
    } catch (error) {
      toast({
        title: "Submission Failed",
        description: "Failed to submit reimbursement request. Please try again.",
        variant: "destructive",
      });
    }
  };

  const onSaveDraft = async () => {
    try {
      const formData = form.getValues();
      
      // Ensure required fields have default values for draft - keep originalReceiptAmount as string
      const draftData: ReimbursementFormData = {
        requestTitle: formData.requestTitle || 'Draft Request',
        reimbursementType: formData.reimbursementType || 'Other',
        amountIdr: formData.amountIdr || '0',
        expenseDate: formData.expenseDate || new Date().toISOString().split('T')[0],
        description: formData.description || 'Draft description',
        companyBenefit: formData.companyBenefit || 'Draft benefit',
        businessPurpose: formData.businessPurpose,
        expectedOutcome: formData.expectedOutcome,
        merchantName: formData.merchantName,
        receiptNumber: formData.receiptNumber,
        originalReceiptAmount: formData.originalReceiptAmount, // Keep as string
        exchangeRate: formData.exchangeRate || '1',
        bankAccountNumber: formData.bankAccountNumber || '',
        bankAccountName: formData.bankAccountName || '',
        bankName: formData.bankName || '',
      };
      
      await createReimbursementRequest.mutateAsync({
        formData: draftData,
        files: uploadedFiles,
        isDraft: true,
      });
      
      toast({
        title: "Draft Saved",
        description: "Your reimbursement request has been saved as draft.",
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

          {/* Reimbursement Details */}
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                Reimbursement Details
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
                  name="reimbursementType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">
                        Reimbursement Type *
                      </FormLabel>
                      <Select name={field.name} onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-9" name={field.name}>
                            <SelectValue placeholder="Select reimbursement type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Transportation">Transportation</SelectItem>
                          <SelectItem value="Accommodation">Accommodation</SelectItem>
                          <SelectItem value="Meals">Meals & Entertainment</SelectItem>
                          <SelectItem value="Office Supplies">Office Supplies</SelectItem>
                          <SelectItem value="Client Entertainment">Client Entertainment</SelectItem>
                          <SelectItem value="Training">Training & Education</SelectItem>
                          <SelectItem value="Medical">Medical Expenses</SelectItem>
                          <SelectItem value="Communication">Communication</SelectItem>
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
                        Reimbursement Amount (IDR) *
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
                  name="exchangeRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">
                        Exchange Rate
                      </FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="1"
                          type="number"
                          step="0.0001"
                          className="h-9"
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="expenseDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">
                        Expense Date *
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
              </div>

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
                        placeholder="Provide detailed description of the expense..."
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
                name="companyBenefit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">
                      Business Justification *
                    </FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Explain how this expense benefits the company..."
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

          {/* Receipt Information */}
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-foreground">
                Receipt Information
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="merchantName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">
                        Merchant/Vendor Name
                      </FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Enter merchant name"
                          className="h-9"
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="receiptNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">
                        Receipt/Invoice Number
                      </FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Enter receipt number"
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
                name="originalReceiptAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">
                      Original Receipt Amount (IDR)
                    </FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="0"
                        type="number"
                        className="h-9"
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

          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-foreground">
                Business Impact
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <FormField
                control={form.control}
                name="businessPurpose"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">
                      Business Purpose
                    </FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="What was the business purpose of this expense?"
                        className="min-h-[70px] resize-none"
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="expectedOutcome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">
                      Expected Outcome/Benefit
                    </FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="What outcome or benefit does this expense provide?"
                        className="min-h-[70px] resize-none"
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-foreground">
                Supporting Documents (Receipts Required)
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
                    id="reimbursement-request-file-upload"
                    name="reimbursement_request_documents"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx,.xls"
                  />
                  <label htmlFor="reimbursement-request-file-upload" className="cursor-pointer">
                    <Upload className="h-6 w-6 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">
                      Click to upload receipts and supporting documents
                    </p>
                    <p className="text-xs text-gray-500">
                      PDF, DOC, DOCX, JPG, PNG, XLSX (max 10MB each)
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
              disabled={createReimbursementRequest.isPending}
            >
              Save as Draft
            </Button>
            <Button 
              type="submit" 
              className="px-6 bg-primary hover:bg-primary/90 flex items-center gap-2"
              disabled={createReimbursementRequest.isPending}
            >
              {createReimbursementRequest.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Submit Reimbursement
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default ReimbursementRequestForm;
