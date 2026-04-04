import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Label } from '@/shared/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Textarea } from '@/shared/components/ui/textarea';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useServices } from '../hooks/useServices';
import { useSubServices } from '../hooks/useSubServices';
import { BookOpen } from 'lucide-react';

interface ProductKnowledgeDetail {
  id?: string;
  service_id: string | null;
  sub_service_id: string | null;
  product_knowledge_content: string;
}

interface ProductKnowledgeDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: Omit<ProductKnowledgeDetail, 'id'>) => Promise<void>;
  initialData?: ProductKnowledgeDetail | null;
  isLoading?: boolean;
}

export const ProductKnowledgeDetailModal: React.FC<ProductKnowledgeDetailModalProps> = ({
  open,
  onOpenChange,
  onSave,
  initialData,
  isLoading = false,
}) => {
  const { t } = useAppTranslation();
  const { data: services = [] } = useServices();
  const { data: subServices = [] } = useSubServices();

  const [formData, setFormData] = useState<Omit<ProductKnowledgeDetail, 'id'>>({
    service_id: null,
    sub_service_id: null,
    product_knowledge_content: '',
  });

  const [selectedServiceId, setSelectedServiceId] = useState<string | undefined>(undefined);

  // Filter sub services based on selected service
  const filteredSubServices = subServices.filter(
    (subService) => subService.service_id === selectedServiceId
  );

  // Reset form when modal opens/closes or initialData changes
  useEffect(() => {
    if (open) {
      if (initialData) {
        setFormData({
          service_id: initialData.service_id || null,
          sub_service_id: initialData.sub_service_id || null,
          product_knowledge_content: initialData.product_knowledge_content || '',
        });
        setSelectedServiceId(initialData.service_id || undefined);
      } else {
        setFormData({
          service_id: null,
          sub_service_id: null,
          product_knowledge_content: '',
        });
        setSelectedServiceId(undefined);
      }
    }
  }, [open, initialData]);

  const handleServiceChange = (value: string) => {
    setSelectedServiceId(value);
    setFormData((prev) => ({
      ...prev,
      service_id: value || null,
      sub_service_id: null, // Reset sub service when service changes
    }));
  };

  const handleSubServiceChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      sub_service_id: value || null,
    }));
  };

  const handleContentChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      product_knowledge_content: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.product_knowledge_content.trim()) {
      return;
    }
    await onSave(formData);
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            {initialData
              ? t('productKnowledgeDetail.modal.editTitle', 'Edit Product Knowledge Detail')
              : t('productKnowledgeDetail.modal.createTitle', 'Create Product Knowledge Detail')}
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-600">
            {t(
              'productKnowledgeDetail.modal.description',
              'Fill in the product knowledge details for the selected service and sub service.'
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="service_id">
              {t('productKnowledgeDetail.modal.service', 'Product Service')} *
            </Label>
            <Select
              value={formData.service_id || undefined}
              onValueChange={handleServiceChange}
              required
            >
              <SelectTrigger id="service_id">
                <SelectValue
                  placeholder={t('productKnowledgeDetail.modal.servicePlaceholder', 'Select service')}
                />
              </SelectTrigger>
              <SelectContent>
                {services
                  .filter((service) => service.id && service.name)
                  .map((service) => (
                    <SelectItem key={service.id} value={service.id!}>
                      {service.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sub_service_id">
              {t('productKnowledgeDetail.modal.subService', 'Sub Service')}
            </Label>
            <Select
              value={formData.sub_service_id || undefined}
              onValueChange={handleSubServiceChange}
              disabled={!selectedServiceId}
            >
              <SelectTrigger id="sub_service_id">
                <SelectValue
                  placeholder={
                    selectedServiceId
                      ? t('productKnowledgeDetail.modal.subServicePlaceholder', 'Select sub service')
                      : t('productKnowledgeDetail.modal.selectServiceFirst', 'Select service first')
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {filteredSubServices
                  .filter((subService) => subService.id && subService.name)
                  .map((subService) => (
                    <SelectItem key={subService.id} value={subService.id!}>
                      {subService.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="product_knowledge_content">
              {t('productKnowledgeDetail.modal.content', 'Product Knowledge Content')} *
            </Label>
            <Textarea
              id="product_knowledge_content"
              value={formData.product_knowledge_content}
              onChange={(e) => handleContentChange(e.target.value)}
              placeholder={t(
                'productKnowledgeDetail.modal.contentPlaceholder',
                'Enter product knowledge content...'
              )}
              rows={10}
              className="resize-none"
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel} disabled={isLoading}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button type="submit" disabled={isLoading || !formData.product_knowledge_content.trim()}>
              {isLoading
                ? t('common.saving', 'Saving...')
                : initialData
                  ? t('common.save', 'Save')
                  : t('common.create', 'Create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

