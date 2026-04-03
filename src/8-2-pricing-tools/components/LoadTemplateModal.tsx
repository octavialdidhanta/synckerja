import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger
} from '@/shared/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Separator } from '@/shared/components/ui/separator';
import { FolderOpen, Globe, Lock, Loader2, Eye } from 'lucide-react';
import { usePricingTemplates, PricingTemplate } from '../hooks/usePricingTemplates';
import { PricingCalculationInput } from '../types/pricingTypes';
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

interface LoadTemplateModalProps {
  onLoadTemplate: (templateData: PricingCalculationInput, templateName?: string) => void;
}

export const LoadTemplateModal = ({ onLoadTemplate }: LoadTemplateModalProps) => {
  const { t } = useAppTranslation();
  const { globalTemplates, organizationTemplates, isLoading } = usePricingTemplates();
  const [isOpen, setIsOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<PricingTemplate | null>(null);

  const handleLoadTemplate = (template: PricingTemplate) => {
    onLoadTemplate(template.template_data, template.template_name);
    setIsOpen(false);
    setPreviewTemplate(null);
  };

  const handlePreview = (template: PricingTemplate) => {
    setPreviewTemplate(template);
  };

  const allTemplates = [
    ...globalTemplates.map(t => ({ ...t, isGlobal: true })),
    ...organizationTemplates.map(t => ({ ...t, isGlobal: false })),
  ];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FolderOpen className="h-4 w-4 mr-2" />
          {t("pricingTools.templates.loadButton", "Load Template")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('pricingTools.templates.load.title', 'Select Template')}</DialogTitle>
          <DialogDescription>
            {t('pricingTools.templates.load.description', 'Select a template to start pricing calculation. Templates contain example cost and expense structures that can be adjusted to your needs.')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex gap-4">
          {/* Templates List */}
          <div className="flex-1 overflow-y-auto seamless-scroll">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mb-3" />
                <p className="text-sm">Loading templates...</p>
              </div>
            ) : allTemplates.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm font-medium">
                  {t('pricingTools.templates.load.noTemplates', 'No templates available')}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Global Templates */}
                {globalTemplates.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Globe className="h-4 w-4 text-brand-blue" />
                      <h3 className="font-semibold text-sm">
                        {t('pricingTools.templates.load.global', 'Global Templates')}
                      </h3>
                    </div>
                    <div className="space-y-2">
                      {globalTemplates.map(template => (
                        <Card
                          key={template.id}
                          className="cursor-pointer hover:shadow-md transition-shadow"
                          onClick={() => handlePreview(template)}
                        >
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <CardTitle className="text-sm font-medium">{template.template_name}</CardTitle>
                                {template.template_description && (
                                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                    {template.template_description}
                                  </p>
                                )}
                              </div>
                              <Badge variant="outline" className="ml-2">
                                <Globe className="h-3 w-3 mr-1" />
                                Global
                              </Badge>
                            </div>
                            {template.category && (
                              <div className="mt-2">
                                <span className="text-xs text-muted-foreground">
                                  {t('pricingTools.templates.load.category', 'Category:')} {template.category}
                                </span>
                              </div>
                            )}
                          </CardHeader>
                          <CardContent className="pt-0">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePreview(template);
                                }}
                                className="h-7 px-3 text-xs"
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                {t('pricingTools.templates.load.preview', 'Preview')}
                              </Button>
                              <Button
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleLoadTemplate(template);
                                }}
                                className="h-7 px-3 text-xs"
                              >
                                {t('pricingTools.templates.load.useTemplate', 'Use Template')}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Organization Templates */}
                {organizationTemplates.length > 0 && (
                  <>
                    {globalTemplates.length > 0 && <Separator className="my-4" />}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Lock className="h-4 w-4 text-primary" />
                        <h3 className="font-semibold text-sm">
                          {t('pricingTools.templates.load.organization', 'My Templates')}
                        </h3>
                      </div>
                      <div className="space-y-2">
                        {organizationTemplates.map(template => (
                          <Card
                            key={template.id}
                            className="cursor-pointer hover:shadow-md transition-shadow"
                            onClick={() => handlePreview(template)}
                          >
                            <CardHeader className="pb-3">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <CardTitle className="text-sm font-medium">{template.template_name}</CardTitle>
                                  {template.template_description && (
                                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                      {template.template_description}
                                    </p>
                                  )}
                                </div>
                                <Badge variant="outline" className="ml-2">
                                  <Lock className="h-3 w-3 mr-1" />
                                  Private
                                </Badge>
                              </div>
                              {template.category && (
                                <div className="mt-2">
                                  <span className="text-xs text-muted-foreground">
                                    {t('pricingTools.templates.load.category', 'Category:')} {template.category}
                                  </span>
                                </div>
                              )}
                            </CardHeader>
                            <CardContent className="pt-0">
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePreview(template);
                                  }}
                                  className="h-7 px-3 text-xs"
                                >
                                  <Eye className="h-3 w-3 mr-1" />
                                  {t('pricingTools.templates.load.preview', 'Preview')}
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleLoadTemplate(template);
                                  }}
                                  className="h-7 px-3 text-xs"
                                >
                                  {t('pricingTools.templates.load.useTemplate', 'Use Template')}
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Preview Panel */}
          {previewTemplate && (
            <>
              <Separator orientation="vertical" />
              <div className="w-80 overflow-y-auto seamless-scroll border-border border-l bg-muted/50 p-4">
                <div className="mb-4">
                  <h3 className="font-semibold text-sm mb-1">{previewTemplate.template_name}</h3>
                  {previewTemplate.template_description && (
                    <p className="text-xs text-muted-foreground">{previewTemplate.template_description}</p>
                  )}
                  {previewTemplate.category && (
                    <Badge variant="outline" className="mt-2 text-xs">
                      {previewTemplate.category}
                    </Badge>
                  )}
                </div>
                
                <Separator className="my-4" />

                <div className="space-y-3 text-xs">
                  <div>
                    <span className="font-medium text-foreground">Product:</span>
                    <p className="text-muted-foreground mt-1">{previewTemplate.template_data.productName}</p>
                  </div>
                  <div>
                    <span className="font-medium text-foreground">Category:</span>
                    <p className="text-muted-foreground mt-1">{previewTemplate.template_data.category}</p>
                  </div>
                  <div>
                    <span className="font-medium text-foreground">Production Cost per Unit:</span>
                    <p className="text-muted-foreground mt-1">
                      {previewTemplate.template_data.productionCostPerUnit
                        ? `Rp ${previewTemplate.template_data.productionCostPerUnit.toLocaleString('id-ID')}`
                        : previewTemplate.template_data.productionUnits
                        ? `(Legacy data - ${previewTemplate.template_data.productionUnits.toLocaleString('id-ID')} units)`
                        : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-foreground">Calculation Method:</span>
                    <p className="text-muted-foreground mt-1 capitalize">{previewTemplate.template_data.calculationMethod}</p>
                  </div>
                  {previewTemplate.template_data.operationalExpenses.length > 0 && (
                    <div>
                      <span className="font-medium text-foreground">Business Expenses:</span>
                      <p className="text-muted-foreground mt-1">
                        {previewTemplate.template_data.operationalExpenses.length} items
                      </p>
                    </div>
                  )}
                  {previewTemplate.template_data.salesChannels.length > 0 && (
                    <div>
                      <span className="font-medium text-foreground">Sales Channels:</span>
                      <p className="text-muted-foreground mt-1">
                        {previewTemplate.template_data.salesChannels.filter(c => c.isActive).length} active
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t">
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => handleLoadTemplate(previewTemplate)}
                  >
                    {t('pricingTools.templates.load.useTemplate', 'Use Template')}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            {t('pricingTools.templates.load.cancel', 'Cancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

