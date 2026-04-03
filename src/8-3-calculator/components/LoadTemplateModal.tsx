import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/shared/components/ui/dialog';
import { Badge } from '@/shared/components/ui/badge';
import { FolderOpen, Share2, Lock, Loader2 } from 'lucide-react';
import { useToast } from '@/shared/components/ui/use-toast';
import { KPITemplate, TemplateCategory, CalculatorType, TEMPLATE_CATEGORIES, ServiceKPISettings, SalesKPISettings } from '@/8-3-calculator/types/kpi-templates';
import { supabase } from '@/shared/lib/supabaseClient';
import { useCentralizedUserData } from '@/shared/auth/contexts/CentralizedUserDataContext';

interface LoadTemplateModalProps {
  calculatorType: CalculatorType;
  onLoadTemplate: (settings: ServiceKPISettings | SalesKPISettings) => void;
}

export const LoadTemplateModal: React.FC<LoadTemplateModalProps> = ({
  calculatorType,
  onLoadTemplate
}) => {
  const { toast } = useToast();
  const { userData } = useCentralizedUserData();
  const organizationId = userData?.active_organization_id ?? null;
  const userId = userData?.user_id ?? null;

  const [templates, setTemplates] = useState<KPITemplate[]>([]);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [isDeletingTemplateId, setIsDeletingTemplateId] = useState<string | null>(null);

  const fetchTemplates = useCallback(
    async (notifyOnError: boolean = false) => {
    if (!organizationId) {
      setTemplates([]);
      return;
    }

    setIsLoadingTemplates(true);
    const { data, error } = await supabase
      .from('campaign_kpi_templates')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('type', calculatorType)
      .order('updated_at', { ascending: false });

    if (error) {
      if (notifyOnError) {
        toast({
          title: 'Unable to load templates',
          description: 'Please try again in a moment.',
          variant: 'destructive'
        });
      }
      setTemplates([]);
    } else {
      setTemplates((data || []) as KPITemplate[]);
    }

    setIsLoadingTemplates(false);
  },
    [organizationId, calculatorType, toast]
  );

  useEffect(() => {
    if (isLibraryOpen) {
      fetchTemplates(true);
    }
  }, [isLibraryOpen, fetchTemplates]);

  const handleDeleteTemplate = async (template: KPITemplate) => {
    if (!userId || template.created_by !== userId) {
      toast({
        title: 'Cannot delete template',
        description: 'Only the creator can delete this template.',
        variant: 'destructive'
      });
      return;
    }

    setIsDeletingTemplateId(template.id);
    const { error } = await supabase
      .from('campaign_kpi_templates')
      .delete()
      .eq('id', template.id)
      .eq('created_by', userId);
    setIsDeletingTemplateId(null);

    if (error) {
      toast({
        title: 'Failed to delete template',
        description: error.message || 'Please try again later.',
        variant: 'destructive'
      });
      return;
    }

    await fetchTemplates(true);
    toast({
      title: 'Template deleted',
      description: `"${template.name}" has been removed.`
    });
  };

  const handleLoadTemplate = (template: KPITemplate) => {
    onLoadTemplate(template.settings);
    setIsLibraryOpen(false);
    
    toast({
      title: "Template Loaded",
      description: `KPI settings from "${template.name}" have been applied`
    });
  };

  const getCategoryLabel = (category: TemplateCategory) => {
    const categories = [...TEMPLATE_CATEGORIES.services, ...TEMPLATE_CATEGORIES.sales];
    return categories.find(c => c.value === category)?.label || category;
  };

  const getCategoryColor = (category: TemplateCategory) => {
    const colors = {
      healthcare: 'bg-green-100 text-green-800',
      legal: 'bg-blue-100 text-blue-800',
      digital_agency: 'bg-purple-100 text-purple-800',
      business_consulting: 'bg-orange-100 text-orange-800',
      ecommerce: 'bg-red-100 text-red-800',
      saas: 'bg-indigo-100 text-indigo-800',
      digital_products: 'bg-pink-100 text-pink-800',
      physical_products: 'bg-yellow-100 text-yellow-800',
      custom: 'bg-gray-100 text-gray-800'
    };
    return colors[category] || colors.custom;
  };

  return (
    <Dialog open={isLibraryOpen} onOpenChange={setIsLibraryOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FolderOpen className="h-4 w-4 mr-2" />
          Load Template
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[min(90vh,680px)] w-[min(640px,calc(100vw-2rem))] min-w-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-[640px]">
        <DialogHeader className="shrink-0 border-b bg-gradient-to-r from-primary/10 to-primary/5 px-6 pb-4 pt-6">
          <div className="flex items-start gap-3 pr-8">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15">
              <FolderOpen className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-left text-xl font-semibold leading-snug">KPI Template Library</DialogTitle>
              <DialogDescription className="mt-1.5 text-left text-sm text-muted-foreground">
                Browse saved templates to quickly apply previous KPI settings.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden px-6 py-5">
          {!organizationId ? (
            <div className="space-y-2 py-8 text-center text-gray-500">
              <p>You need an active organization to access KPI templates.</p>
              <p className="text-sm">Join or create an organization, then save templates for your campaigns.</p>
            </div>
          ) : isLoadingTemplates ? (
            <div className="flex flex-col items-center justify-center space-y-3 py-8 text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              <p>Loading templates...</p>
            </div>
          ) : templates.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {templates.map((template) => (
                <Card key={template.id} className="cursor-pointer transition-shadow hover:shadow-md">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-sm font-medium">{template.name}</CardTitle>
                        <p className="mt-1 text-xs text-gray-500">{template.description}</p>
                      </div>
                      <Badge className={`text-xs ${getCategoryColor(template.category)}`}>
                        {getCategoryLabel(template.category)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        {template.is_public ? (
                          <>
                            <Share2 className="h-3 w-3 text-primary" />
                            <span>Shared with organization</span>
                          </>
                        ) : (
                          <>
                            <Lock className="h-3 w-3 text-gray-400" />
                            <span>Private template</span>
                          </>
                        )}
                      </div>
                      <span>Used {template.usage_count ?? 0} times</span>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleLoadTemplate(template)}
                        className="h-7 px-3 text-xs"
                      >
                        Load
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteTemplate(template)}
                        className="h-7 px-3 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                        disabled={isDeletingTemplateId === template.id}
                      >
                        {isDeletingTemplateId === template.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          "Delete"
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-gray-500">
              <FolderOpen className="mx-auto mb-2 h-12 w-12 opacity-50" />
              <p>No templates found for {calculatorType} calculator</p>
              <p className="text-sm">Save your current settings as a template to get started</p>
            </div>
          )}
        </div>
        <DialogFooter className="shrink-0 border-t bg-muted/30 px-6 py-4 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => setIsLibraryOpen(false)} className="w-full sm:w-auto">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

