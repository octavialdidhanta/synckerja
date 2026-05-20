import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFormScrollArea,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { useCurrentOrg } from '@/shared/auth/hooks/useCurrentOrg';
import { useInvoiceTemplate } from '@/shared/hooks/useInvoiceTemplate';
import { useToast } from '@/shared/components/ui/use-toast';
import {
  uploadInvoiceTemplateLogo,
  uploadInvoiceTemplateSignature,
} from '@/shared/lib/invoiceTemplateLogo';
import type { InvoiceTemplate, InvoiceTemplateFormData } from '@/shared/types/invoice';

/** Square 1:1 preview for logo / stamp uploads */
const IMAGE_PREVIEW_BOX =
  'relative flex aspect-square size-24 shrink-0 items-center justify-center overflow-hidden rounded-md border border-dashed border-gray-300 bg-muted/40';

const EMPTY_FORM: InvoiceTemplateFormData = {
  template_name: '',
  company_name: '',
  company_phone: '',
  company_email: '',
  company_address: '',
  invoice_description: '',
  company_logo_path: null,
  company_signature_path: null,
};

interface CreateTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a template is saved so the parent can select it in the invoice preview. */
  onTemplateCreated?: (template: InvoiceTemplate) => void;
}

export const CreateTemplateDialog: React.FC<CreateTemplateDialogProps> = ({
  open,
  onOpenChange,
  onTemplateCreated,
}) => {
  const { organizationId } = useCurrentOrg();
  const { createTemplate } = useInvoiceTemplate();
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<InvoiceTemplateFormData>(EMPTY_FORM);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signaturePreviewUrl, setSignaturePreviewUrl] = useState<string | null>(null);

  const revokeBlob = (url: string | null) => {
    if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (!open) return;
    setFormData(EMPTY_FORM);
    setLogoFile(null);
    setSignatureFile(null);
    setLogoPreviewUrl((prev) => {
      revokeBlob(prev);
      return null;
    });
    setSignaturePreviewUrl((prev) => {
      revokeBlob(prev);
      return null;
    });
  }, [open]);

  const handleInputChange = (field: keyof InvoiceTemplateFormData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleLogoChange = (file: File | null) => {
    setLogoPreviewUrl((prev) => {
      revokeBlob(prev);
      return file ? URL.createObjectURL(file) : null;
    });
    setLogoFile(file);
  };

  const handleSignatureChange = (file: File | null) => {
    setSignaturePreviewUrl((prev) => {
      revokeBlob(prev);
      return file ? URL.createObjectURL(file) : null;
    });
    setSignatureFile(file);
  };

  const uploadImageAsset = async (
    file: File,
    uploadFn: (orgId: string, f: File) => Promise<string>,
    label: 'Logo' | 'Signature',
  ): Promise<string | null> => {
    try {
      return await uploadFn(organizationId!, file);
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      const description =
        code === 'invalid_image_type'
          ? 'Please choose a PNG, JPG, or WebP image.'
          : code === 'image_too_large'
            ? `${label} must be smaller than 5 MB.`
            : `Could not upload ${label.toLowerCase()}. Try again.`;
      toast({ title: `${label} upload failed`, description, variant: 'destructive' });
      throw err;
    }
  };

  const handleSave = async () => {
    const name = formData.template_name.trim();
    if (!name) {
      toast({
        title: 'Template name required',
        description: 'Enter a template name before saving.',
        variant: 'destructive',
      });
      return;
    }

    if (!organizationId) {
      toast({
        title: 'Organization required',
        description: 'Select an organization before saving a template.',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    try {
      let companyLogoPath: string | null = null;
      let companySignaturePath: string | null = null;
      try {
        if (logoFile) {
          companyLogoPath = await uploadImageAsset(logoFile, uploadInvoiceTemplateLogo, 'Logo');
        }
        if (signatureFile) {
          companySignaturePath = await uploadImageAsset(
            signatureFile,
            uploadInvoiceTemplateSignature,
            'Signature',
          );
        }
      } catch {
        return;
      }

      const payload: InvoiceTemplateFormData = {
        template_name: name,
        company_name: formData.company_name.trim(),
        company_phone: formData.company_phone.trim(),
        company_email: formData.company_email.trim(),
        company_address: formData.company_address.trim(),
        invoice_description: formData.invoice_description.trim(),
        company_logo_path: companyLogoPath,
        company_signature_path: companySignaturePath,
      };

      const result = await createTemplate(payload);
      if (result.success && result.data) {
        toast({
          title: 'Template saved',
          description: `"${result.data.template_name}" is ready to use.`,
        });
        onTemplateCreated?.(result.data);
        setFormData(EMPTY_FORM);
        handleLogoChange(null);
        handleSignatureChange(null);
        onOpenChange(false);
        return;
      }

      const err = result.error as { message?: string } | undefined;
      const message =
        err?.message?.includes('invoice_templates')
          ? 'Invoice templates table is not set up. Apply database migrations or contact an admin.'
          : err?.message || 'Could not save template. Please try again.';

      toast({
        title: 'Failed to save template',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancel = () => {
    setFormData(EMPTY_FORM);
    handleLogoChange(null);
    handleSignatureChange(null);
    onOpenChange(false);
  };

  const canSave = Boolean(formData.template_name.trim()) && Boolean(organizationId) && !isCreating;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90dvh,640px)] max-w-md flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="shrink-0 px-6 pb-2 pt-6">
          <DialogTitle>Create New Template</DialogTitle>
        </DialogHeader>

        <form
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSave();
          }}
        >
          <DialogFormScrollArea className="px-6 py-1">
            <div className="space-y-4 pb-2">
          <div>
            <Label htmlFor="template_name">Template Name</Label>
            <Input
              id="template_name"
              placeholder="Enter template name"
              value={formData.template_name}
              onChange={(e) => handleInputChange('template_name', e.target.value)}
              disabled={isCreating}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template_logo">Company Logo (on invoice)</Label>
            <div className="flex items-start gap-3">
              <div className={IMAGE_PREVIEW_BOX}>
                {logoPreviewUrl ? (
                  <img
                    src={logoPreviewUrl}
                    alt=""
                    className="absolute inset-0 size-full object-contain p-1"
                  />
                ) : (
                  <span className="px-1 text-center text-[10px] text-muted-foreground">No logo</span>
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Input
                  id="template_logo"
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                  disabled={isCreating}
                  className="cursor-pointer text-sm"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    handleLogoChange(f);
                  }}
                />
                {logoPreviewUrl ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-fit px-2 text-destructive hover:text-destructive"
                    disabled={isCreating}
                    onClick={() => handleLogoChange(null)}
                  >
                    Remove logo
                  </Button>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  PNG or JPG, max 5 MB. Replaces the LOGO box on the invoice PDF.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="template_signature">Stamp / Signature (on invoice)</Label>
            <div className="flex items-start gap-3">
              <div className={IMAGE_PREVIEW_BOX}>
                {signaturePreviewUrl ? (
                  <img
                    src={signaturePreviewUrl}
                    alt=""
                    className="absolute inset-0 size-full object-contain p-1"
                  />
                ) : (
                  <span className="px-1 text-center text-[10px] text-muted-foreground">No stamp</span>
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Input
                  id="template_signature"
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                  disabled={isCreating}
                  className="cursor-pointer text-sm"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    handleSignatureChange(f);
                  }}
                />
                {signaturePreviewUrl ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-fit px-2 text-destructive hover:text-destructive"
                    disabled={isCreating}
                    onClick={() => handleSignatureChange(null)}
                  >
                    Remove stamp
                  </Button>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  PNG or JPG, max 5 MB. Shown above the company signature line on the invoice.
                </p>
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="company_name">Company Name</Label>
            <Input
              id="company_name"
              placeholder="Your Company Name"
              value={formData.company_name}
              onChange={(e) => handleInputChange('company_name', e.target.value)}
              disabled={isCreating}
            />
          </div>

          <div>
            <Label htmlFor="company_phone">Phone</Label>
            <Input
              id="company_phone"
              placeholder="+62 xxx xxxx xxxx"
              value={formData.company_phone}
              onChange={(e) => handleInputChange('company_phone', e.target.value)}
              disabled={isCreating}
            />
          </div>

          <div>
            <Label htmlFor="company_email">Email</Label>
            <Input
              id="company_email"
              placeholder="info@company.com"
              value={formData.company_email}
              onChange={(e) => handleInputChange('company_email', e.target.value)}
              disabled={isCreating}
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
              disabled={isCreating}
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
              disabled={isCreating}
            />
          </div>
            <div
              className="h-2 flex-shrink-0 [@media(max-height:900px)]:h-3 [@media(max-height:760px)]:h-4"
              aria-hidden
            />
            </div>
          </DialogFormScrollArea>

          <DialogFooter className="shrink-0 gap-2 border-t bg-background px-6 py-4">
            <Button type="button" variant="outline" onClick={handleCancel} disabled={isCreating}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSave}>
              {isCreating ? 'Creating...' : 'Save Template'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
