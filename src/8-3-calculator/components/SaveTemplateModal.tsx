import React, { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/shared/components/ui/dialog';
import { Textarea } from '@/shared/components/ui/textarea';
import { Save, Loader2 } from 'lucide-react';
import { useToast } from '@/shared/components/ui/use-toast';
import { KPITemplate, TemplateCategory, CalculatorType, TEMPLATE_CATEGORIES, ServiceKPISettings, SalesKPISettings } from '@/8-3-calculator/types/kpi-templates';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCentralizedUserData } from '@/shared/auth/contexts/CentralizedUserDataContext';

interface SaveTemplateModalProps {
  calculatorType: CalculatorType;
  currentSettings: ServiceKPISettings | SalesKPISettings;
  onSaveSuccess?: () => void;
  onSaveTemplate?: (template: Omit<KPITemplate, 'id' | 'created_at' | 'updated_at' | 'usage_count'>) => void;
}

export const SaveTemplateModal: React.FC<SaveTemplateModalProps> = ({
  calculatorType,
  currentSettings,
  onSaveSuccess,
  onSaveTemplate
}) => {
  const { toast } = useToast();
  const { userData } = useCentralizedUserData();
  const organizationId = userData?.active_organization_id ?? null;
  const userId = userData?.user_id ?? null;

  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [saveForm, setSaveForm] = useState({
    name: '',
    description: '',
    category: '' as TemplateCategory,
    is_public: false
  });

  const handleSaveTemplate = async () => {
    if (!saveForm.name || !saveForm.category) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    if (!organizationId || !userId) {
      toast({
        title: "Organization Required",
        description: "Please select an active organization before saving templates.",
        variant: "destructive"
      });
      return;
    }

    const templatePayload: Omit<KPITemplate, 'id' | 'created_at' | 'updated_at' | 'usage_count'> = {
      name: saveForm.name,
      description: saveForm.description,
      category: saveForm.category,
      type: calculatorType,
      settings: currentSettings,
      created_by: userId,
      organization_id: organizationId ?? undefined,
      is_public: saveForm.is_public
    };

    setIsSavingTemplate(true);
    const { data, error } = await supabase
      .from('campaign_kpi_templates')
      .insert({
        name: templatePayload.name,
        description: templatePayload.description,
        category: templatePayload.category,
        type: templatePayload.type,
        settings: templatePayload.settings,
        is_public: templatePayload.is_public,
        organization_id: organizationId,
        created_by: userId
      })
      .select()
      .single();
    setIsSavingTemplate(false);

    if (error) {
      toast({
        title: "Failed to save template",
        description: error.message || "Please try again later.",
        variant: "destructive"
      });
      return;
    }

    setIsSaveDialogOpen(false);
    setSaveForm({ name: '', description: '', category: '' as TemplateCategory, is_public: false });
    
    toast({
      title: "Template Saved",
      description: `KPI template "${saveForm.name}" has been saved successfully`
    });

    if (onSaveTemplate) {
      onSaveTemplate(templatePayload);
    }

    if (onSaveSuccess) {
      onSaveSuccess();
    }
  };

  return (
    <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Save className="h-4 w-4 mr-2" />
          Save Template
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[min(90vh,640px)] w-[min(520px,calc(100vw-2rem))] min-w-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-[520px]">
        <DialogHeader className="shrink-0 border-b bg-gradient-to-r from-primary/10 to-primary/5 px-6 pb-4 pt-6">
          <div className="flex items-start gap-3 pr-8">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15">
              <Save className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-left text-xl font-semibold leading-snug">
                Save KPI Template
              </DialogTitle>
              <DialogDescription className="mt-1.5 text-left text-sm text-muted-foreground">
                Store your current KPI calculator settings for quick reuse.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 py-5">
          <div className="flex flex-col gap-5">
            <div className="flex min-w-0 flex-col gap-2">
              <Label htmlFor="template-name">Template Name *</Label>
              <Input
                id="template-name"
                className="w-full min-w-0"
                value={saveForm.name}
                onChange={(e) => setSaveForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Healthcare Patient Acquisition"
              />
            </div>

            <div className="flex min-w-0 flex-col gap-2">
              <Label htmlFor="template-category">Category *</Label>
              <Select
                value={saveForm.category}
                onValueChange={(value: TemplateCategory) => setSaveForm((prev) => ({ ...prev, category: value }))}
              >
                <SelectTrigger id="template-category" className="w-full min-w-0">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {(calculatorType === "services" ? TEMPLATE_CATEGORIES.services : TEMPLATE_CATEGORIES.sales).map(
                    (cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        <div>
                          <div className="font-medium">{cat.label}</div>
                          <div className="text-xs text-gray-500">{cat.description}</div>
                        </div>
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="flex min-w-0 flex-col gap-2">
              <Label htmlFor="template-description">Description</Label>
              <Textarea
                id="template-description"
                className="min-h-[88px] w-full min-w-0 resize-y"
                value={saveForm.description}
                onChange={(e) => setSaveForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Describe when to use this template..."
                rows={3}
              />
            </div>

            <div className="flex items-start gap-2.5 pt-0.5">
              <input
                type="checkbox"
                id="is-public"
                checked={saveForm.is_public}
                onChange={(e) => setSaveForm((prev) => ({ ...prev, is_public: e.target.checked }))}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300"
              />
              <Label htmlFor="is-public" className="text-sm font-normal leading-snug">
                Share with team (make template public)
              </Label>
            </div>
          </div>
        </div>
        <DialogFooter className="shrink-0 gap-2 border-t bg-muted/30 px-6 py-4 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button
            onClick={handleSaveTemplate}
            disabled={isSavingTemplate}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto"
          >
            {isSavingTemplate && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

