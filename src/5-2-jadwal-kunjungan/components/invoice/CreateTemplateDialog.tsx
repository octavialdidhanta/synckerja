import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { useInvoiceTemplate } from '@/shared/hooks/useInvoiceTemplate';
import type { InvoiceTemplateFormData } from '@/shared/types/invoice';

interface CreateTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateTemplateDialog: React.FC<CreateTemplateDialogProps> = ({
  open,
  onOpenChange
}) => {
  const { createTemplate } = useInvoiceTemplate();
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<InvoiceTemplateFormData>({
    template_name: '',
    company_name: '',
    company_phone: '',
    company_email: '',
    company_address: '',
    invoice_description: ''
  });

  const handleInputChange = (field: keyof InvoiceTemplateFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    if (!formData.template_name.trim()) {
      return;
    }

    setIsCreating(true);
    try {
      const result = await createTemplate(formData);
      if (result.success) {
        // Reset form
        setFormData({
          template_name: '',
          company_name: '',
          company_phone: '',
          company_email: '',
          company_address: '',
          invoice_description: ''
        });
        onOpenChange(false);
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancel = () => {
    // Reset form
    setFormData({
      template_name: '',
      company_name: '',
      company_phone: '',
      company_email: '',
      company_address: '',
      invoice_description: ''
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Template</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="template_name">Template Name</Label>
            <Input
              id="template_name"
              placeholder="Enter template name"
              value={formData.template_name}
              onChange={(e) => handleInputChange('template_name', e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="company_name">Company Name</Label>
            <Input
              id="company_name"
              placeholder="Your Company Name"
              value={formData.company_name}
              onChange={(e) => handleInputChange('company_name', e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="company_phone">Phone</Label>
            <Input
              id="company_phone"
              placeholder="+62 xxx xxxx xxxx"
              value={formData.company_phone}
              onChange={(e) => handleInputChange('company_phone', e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="company_email">Email</Label>
            <Input
              id="company_email"
              placeholder="info@company.com"
              value={formData.company_email}
              onChange={(e) => handleInputChange('company_email', e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="company_address">Address</Label>
            <Textarea
              id="company_address"
              placeholder="Jl. Example Street No. 123&#10;Jakarta, Indonesia"
              value={formData.company_address}
              onChange={(e) => handleInputChange('company_address', e.target.value)}
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="invoice_description">Invoice Description (Additional Notes)</Label>
            <Textarea
              id="invoice_description"
              placeholder="Add any additional notes or descriptions that will appear on the invoice..."
              value={formData.invoice_description}
              onChange={(e) => handleInputChange('invoice_description', e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={handleCancel}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={isCreating || !formData.template_name.trim()}
          >
            {isCreating ? 'Creating...' : 'Save Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
