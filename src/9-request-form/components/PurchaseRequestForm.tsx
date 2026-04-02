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
import { Upload, FileText, X, User, Building2, Clipboard, CheckCircle } from 'lucide-react';
import { useCurrentUserEmployee } from '@/1-home/components/HomeOKRDashboard/component/SectionGreetingsImport/useCurrentUserEmployee';
import { useCreatePurchaseRequest } from '@/9-request-form/hooks/usePurchaseRequests';
import { toast } from '@/shared/components/ui/use-toast';

const purchaseRequestSchema = z.object({
  purchaseType: z.string().min(1, 'Purchase type is required'),
  requestTitle: z.string().min(1, 'Request title is required'),
  amountIdr: z.string().min(1, 'Amount is required'),
  quantity: z.union([z.number().int().min(1), z.string()]).optional().transform((v) => (v === '' || v == null ? 1 : Math.max(1, typeof v === 'string' ? parseInt(v, 10) || 1 : v))),
  isRecurring: z.boolean().default(false),
  recurringFrequency: z.string().optional(),
  description: z.string().min(1, 'Description is required'),
  companyBenefit: z.string().min(1, 'Company benefit is required'),
  productivityImpact: z.string().optional(),
  efficiencyImpact: z.string().optional(),
  expectedOutcome: z.string().optional(),
  vendorName: z.string().optional(),
  purchaseLink: z.string().optional(),
  accountUsername: z.string().optional(),
  accountPassword: z.string().optional(),
});

type PurchaseRequestFormData = z.infer<typeof purchaseRequestSchema>;

const PurchaseRequestForm = () => {
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const { data: currentEmployee } = useCurrentUserEmployee();
  const createPurchaseRequest = useCreatePurchaseRequest();

  const form = useForm<PurchaseRequestFormData>({
    resolver: zodResolver(purchaseRequestSchema),
    defaultValues: {
      purchaseType: '',
      requestTitle: '',
      amountIdr: '',
      quantity: 1,
      isRecurring: false,
      recurringFrequency: '',
      description: '',
      companyBenefit: '',
      productivityImpact: '',
      efficiencyImpact: '',
      expectedOutcome: '',
      vendorName: '',
      purchaseLink: '',
      accountUsername: '',
      accountPassword: '',
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

  const onSubmit = async (data: PurchaseRequestFormData) => {
    try {
      const quantity = data.purchaseType === 'Physical Item' ? (Number(data.quantity) || 1) : 1;
      await createPurchaseRequest.mutateAsync({
        formData: { ...data, quantity },
        files: uploadedFiles,
        isDraft: false,
      });
      
      // Show success toast
      toast({
        title: "Request Submitted Successfully!",
        description: "Your purchase request has been submitted and is now pending approval.",
        variant: "default",
      });
      
      // Reset form after successful submission
      form.reset();
      setUploadedFiles([]);
    } catch (error) {
      // Show error toast
      toast({
        title: "Submission Failed",
        description: "Failed to submit purchase request. Please try again.",
        variant: "destructive",
      });
    }
  };

  const onSaveDraft = async () => {
    try {
      const data = form.getValues();
      await createPurchaseRequest.mutateAsync({
        formData: data,
        files: uploadedFiles,
        isDraft: true,
      });
      
      // Show draft saved toast
      toast({
        title: "Draft Saved",
        description: "Your purchase request has been saved as draft.",
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

          {/* Request Details */}
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <Clipboard className="h-5 w-5 text-primary" />
                Request Details
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {/* Purchase Type and Title Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="purchaseType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">
                        Purchase Type *
                      </FormLabel>
                      <Select name={field.name} onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-9" name={field.name}>
                            <SelectValue placeholder="Select purchase type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Physical Item">Physical Item</SelectItem>
                          <SelectItem value="Google Ads Budget">Google Ads Budget</SelectItem>
                          <SelectItem value="Meta/Facebook Ads Budget">Meta/Facebook Ads Budget</SelectItem>
                          <SelectItem value="Software/Subscription">Software/Subscription</SelectItem>
                          <SelectItem value="Service">Service</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
              </div>

              {/* Amount, Quantity (Physical Item), Recurring Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <FormField
                  control={form.control}
                  name="amountIdr"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">
                        Amount (IDR) *
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

                {form.watch('purchaseType') === 'Physical Item' && (
                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-gray-700">
                          Quantity *
                        </FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="1"
                            type="number"
                            min={1}
                            className="h-9"
                            {...field}
                            value={field.value ?? 1}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value, 10) : 1)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

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
                        Recurring Purchase
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
                          Frequency
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
                            <SelectItem value="Annually">Annually</SelectItem>
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
                        placeholder="Provide detailed description of the purchase request..."
                        className="min-h-[80px] resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Company Benefit */}
              <FormField
                control={form.control}
                name="companyBenefit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">
                      Company Benefit *
                    </FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Explain how this purchase will benefit the company..."
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

          {/* Business Impact Analysis */}
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-foreground">
                Business Impact Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="productivityImpact"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">
                        Productivity Impact
                      </FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="How will this improve productivity?"
                          className="min-h-[70px] resize-none"
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="efficiencyImpact"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">
                        Efficiency Impact
                      </FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="How will this improve efficiency?"
                          className="min-h-[70px] resize-none"
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="expectedOutcome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">
                      Expected Outcome
                    </FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="What specific outcomes do you expect from this purchase?"
                        className="min-h-[70px] resize-none"
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Vendor Information */}
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-foreground">
                Vendor Information
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="vendorName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">
                        Vendor Name
                      </FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Enter vendor name"
                          className="h-9"
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="purchaseLink"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">
                        Purchase Link/URL
                      </FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="https://..."
                          className="h-9"
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="accountUsername"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">
                        Account Username (if applicable)
                      </FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Enter username"
                          className="h-9"
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="accountPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">
                        Account Password (if applicable)
                      </FormLabel>
                      <FormControl>
                        <Input 
                          type="password"
                          placeholder="Enter password"
                          className="h-9"
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
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
                    id="purchase-request-file-upload"
                    name="purchase_request_documents"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx,.xls"
                  />
                  <label htmlFor="purchase-request-file-upload" className="cursor-pointer">
                    <Upload className="h-6 w-6 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">
                      Click to upload or drag and drop
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
              disabled={createPurchaseRequest.isPending}
            >
              Save as Draft
            </Button>
            <Button 
              type="submit" 
              className="px-6 bg-primary hover:bg-primary/90 flex items-center gap-2"
              disabled={createPurchaseRequest.isPending}
            >
              {createPurchaseRequest.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Submit Request
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default PurchaseRequestForm;
