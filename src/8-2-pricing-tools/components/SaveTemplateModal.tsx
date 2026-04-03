import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger
} from '@/shared/components/ui/dialog';
import { Save, Loader2 } from 'lucide-react';
import { usePricingTemplates } from '../hooks/usePricingTemplates';
import { PricingCalculationInput } from '../types/pricingTypes';
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useToast } from "@/shared/components/ui/use-toast";

interface SaveTemplateModalProps {
  calculationInput: PricingCalculationInput | null;
  disabled?: boolean;
}

export const SaveTemplateModal = ({ calculationInput, disabled }: SaveTemplateModalProps) => {
  const { t } = useAppTranslation();
  const { toast } = useToast();
  const { saveTemplate } = usePricingTemplates();
  const [isOpen, setIsOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [category, setCategory] = useState('');

  const handleSave = async () => {
    if (!calculationInput || !templateName.trim()) {
      return;
    }

    try {
      await saveTemplate.mutateAsync({
        template_name: templateName.trim(),
        template_description: templateDescription.trim() || null,
        category: category.trim() || null,
        template_data: calculationInput,
      });

      toast({ title: t("pricingTools.templates.save.success", "Template saved successfully") });
      setIsOpen(false);
      setTemplateName('');
      setTemplateDescription('');
      setCategory('');
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: t("pricingTools.templates.save.error", "Failed to save template"),
        description: error?.message,
      });
    }
  };

  const isFormValid = templateName.trim().length > 0 && calculationInput !== null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled || !calculationInput}>
          <Save className="h-4 w-4 mr-2" />
          {t("pricingTools.templates.saveButton", "Save as Template")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('pricingTools.templates.save.title', 'Save Template')}</DialogTitle>
          <DialogDescription>
            {t(
              "pricingTools.templates.save.intro",
              "Save current configuration as a template for future use",
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="template-name">
              {t('pricingTools.templates.save.name', 'Template Name')} *
            </Label>
            <Input
              id="template-name"
              placeholder="e.g., Parfum Import - Basic Setup"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="template-description">
              {t(
                "pricingTools.templates.save.descriptionFieldLabel",
                "Template Description",
              )}
            </Label>
            <Textarea
              id="template-description"
              placeholder="Brief description of this template..."
              value={templateDescription}
              onChange={(e) => setTemplateDescription(e.target.value)}
              className="mt-1"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="template-category">
              {t('pricingTools.templates.save.category', 'Category')}
            </Label>
            <Input
              id="template-category"
              placeholder="e.g., Parfum Import, Food & Beverage"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => {
              setIsOpen(false);
              setTemplateName('');
              setTemplateDescription('');
              setCategory('');
            }}
            disabled={saveTemplate.isPending}
          >
            {t('pricingTools.templates.save.cancel', 'Cancel')}
          </Button>
          <Button 
            onClick={handleSave}
            disabled={!isFormValid || saveTemplate.isPending}
          >
            {saveTemplate.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              t('pricingTools.templates.save.save', 'Save')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};


