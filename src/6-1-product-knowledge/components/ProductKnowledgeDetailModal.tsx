import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFormScrollArea,
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
import { Input } from '@/shared/components/ui/input';
import { Checkbox } from '@/shared/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useServices } from '../hooks/useServices';
import { useSubServices } from '../hooks/useSubServices';
import { useContentPillarsSelect } from '../hooks/useContentPillarsSelect';
import type { ProductKnowledgeDetail } from '../hooks/useProductKnowledgeDetail';
import { Badge } from '@/shared/components/ui/badge';
import { BookOpen, Plus, Search, X } from 'lucide-react';
import type { ContentPillarOption } from '../hooks/useContentPillarsSelect';

function buildPillarDescriptionBlock(pillar: Pick<ContentPillarOption, 'name' | 'description'>): string {
  const description = pillar.description?.trim();
  if (!description) return '';
  return `${pillar.name.trim()}\n${description}`;
}

function appendPillarDescriptionToContent(content: string, block: string): string {
  if (!block) return content;
  const trimmedContent = content.trim();
  if (!trimmedContent) return block;
  if (trimmedContent.includes(block)) return content;
  return `${trimmedContent}\n\n${block}`;
}

export type ProductKnowledgeDetailFormPayload = Pick<
  ProductKnowledgeDetail,
  | 'service_id'
  | 'sub_service_id'
  | 'title'
  | 'perspective'
  | 'product_knowledge_content'
> & { content_pillar_ids: string[] };

interface ProductKnowledgeDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: ProductKnowledgeDetailFormPayload) => Promise<void>;
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
  const { data: contentPillars = [] } = useContentPillarsSelect();

  const [formData, setFormData] = useState<ProductKnowledgeDetailFormPayload>({
    service_id: null,
    sub_service_id: null,
    content_pillar_ids: [],
    title: '',
    perspective: '',
    product_knowledge_content: '',
  });

  const [selectedServiceId, setSelectedServiceId] = useState<string | undefined>(undefined);
  const [pillarPopoverOpen, setPillarPopoverOpen] = useState(false);
  const [pillarSearchQuery, setPillarSearchQuery] = useState('');

  const filteredSubServices = subServices.filter(
    (subService) => subService.service_id === selectedServiceId
  );

  useEffect(() => {
    if (open) {
      if (initialData) {
        setFormData({
          service_id: initialData.service_id || null,
          sub_service_id: initialData.sub_service_id || null,
          content_pillar_ids: [...(initialData.content_pillar_ids || [])],
          title: initialData.title?.trim() ? initialData.title : '',
          perspective:
            typeof initialData.perspective === 'string' && initialData.perspective.trim()
              ? initialData.perspective
              : '',
          product_knowledge_content: initialData.product_knowledge_content || '',
        });
        setSelectedServiceId(initialData.service_id || undefined);
      } else {
        setFormData({
          service_id: null,
          sub_service_id: null,
          content_pillar_ids: [],
          title: '',
          perspective: '',
          product_knowledge_content: '',
        });
        setSelectedServiceId(undefined);
      }
      setPillarSearchQuery('');
    }
  }, [open, initialData]);

  const handlePillarToggle = (pillarId: string) => {
    const pillar = contentPillars.find((p) => p.id === pillarId);
    setFormData((prev) => {
      const isRemoving = prev.content_pillar_ids.includes(pillarId);
      const nextPillarIds = isRemoving
        ? prev.content_pillar_ids.filter((id) => id !== pillarId)
        : [...prev.content_pillar_ids, pillarId];

      if (isRemoving || !pillar) {
        return { ...prev, content_pillar_ids: nextPillarIds };
      }

      const descriptionBlock = buildPillarDescriptionBlock(pillar);
      return {
        ...prev,
        content_pillar_ids: nextPillarIds,
        product_knowledge_content: appendPillarDescriptionToContent(
          prev.product_knowledge_content,
          descriptionBlock,
        ),
      };
    });
  };

  const handleRemovePillar = (pillarId: string) => {
    setFormData((prev) => ({
      ...prev,
      content_pillar_ids: prev.content_pillar_ids.filter((id) => id !== pillarId),
    }));
  };

  const handleServiceChange = (value: string) => {
    setSelectedServiceId(value);
    setFormData((prev) => ({
      ...prev,
      service_id: value || null,
      sub_service_id: null,
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

  const handleTitleChange = (value: string) => {
    setFormData((prev) => ({ ...prev, title: value }));
  };

  const handlePerspectiveChange = (value: string) => {
    setFormData((prev) => ({ ...prev, perspective: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.product_knowledge_content.trim()) {
      return;
    }
    await onSave({
      ...formData,
      content_pillar_ids: [...new Set(formData.content_pillar_ids.filter(Boolean))],
      title: formData.title.trim(),
      perspective: formData.perspective.trim(),
    });
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-[600px]">
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            {initialData
              ? t('productKnowledgeDetail.modal.editTitle', 'Edit Creative Detail')
              : t('productKnowledgeDetail.modal.createTitle', 'Create Creative Detail')}
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-600">
            {t(
              'productKnowledgeDetail.modal.description',
              'Fill in the creative details for the selected service and sub service.',
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-4">
          <DialogFormScrollArea className="space-y-4 pr-1">
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
            <Label htmlFor="content_pillars_add">
              {t('productKnowledgeDetail.modal.contentPillar', 'Content Pillar')}
            </Label>
            <div
              id="content_pillars_multi"
              className="flex min-h-[44px] flex-wrap items-center gap-2 rounded-md border border-input bg-background px-2 py-2"
            >
              {formData.content_pillar_ids.length === 0 ? (
                <span className="text-sm text-muted-foreground px-1">
                  {t(
                    'productKnowledgeDetail.modal.contentPillarChipEmpty',
                    'Belum ada pillar — tambah lewat tombol di kanan.',
                  )}
                </span>
              ) : (
                formData.content_pillar_ids.map((pillarId) => {
                  const pillar = contentPillars.find((p) => p.id === pillarId);
                  const label = pillar?.name?.trim() || pillarId.slice(0, 8);
                  return (
                    <Badge
                      key={pillarId}
                      variant="secondary"
                      className="h-8 max-w-full gap-1 py-0 pl-2.5 pr-1 font-normal"
                    >
                      <span className="max-w-[220px] truncate" title={label}>
                        {label}
                      </span>
                      <button
                        type="button"
                        className="rounded-full p-0.5 text-muted-foreground hover:bg-background/80 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                        onClick={() => handleRemovePillar(pillarId)}
                        disabled={isLoading}
                        aria-label={t('productKnowledgeDetail.modal.contentPillarRemove', 'Hapus {{name}}', {
                          name: label,
                        })}
                      >
                        <X className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      </button>
                    </Badge>
                  );
                })
              )}
              <Popover
                open={pillarPopoverOpen}
                onOpenChange={(o) => {
                  setPillarPopoverOpen(o);
                  if (!o) setPillarSearchQuery('');
                }}
              >
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    id="content_pillars_add"
                    variant="outline"
                    size="sm"
                    className="h-8 shrink-0 gap-1"
                    disabled={isLoading}
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                    {t('productKnowledgeDetail.modal.contentPillarAdd', 'Tambah')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="z-[130] flex w-80 max-w-[calc(100vw-2rem)] flex-col overflow-hidden border bg-popover p-0 shadow-md"
                  align="start"
                  side="bottom"
                  sideOffset={6}
                  collisionPadding={16}
                >
                  <div className="shrink-0 border-b p-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder={t('productKnowledgeDetail.modal.contentPillarSearch', 'Cari pillar…')}
                        value={pillarSearchQuery}
                        onChange={(e) => setPillarSearchQuery(e.target.value)}
                        className="pl-8 h-8 text-sm"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                  <div
                    className="max-h-[min(320px,50dvh)] touch-pan-y overflow-y-auto overflow-x-hidden overscroll-contain p-2 [-ms-overflow-style:auto] [scrollbar-gutter:stable] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border"
                    onWheel={(e) => e.stopPropagation()}
                  >
                    {(() => {
                      const filtered = contentPillars.filter((pillar) =>
                        pillar.name.toLowerCase().includes(pillarSearchQuery.toLowerCase()),
                      );
                      if (filtered.length === 0) {
                        return (
                          <p className="text-sm text-muted-foreground text-center py-3 px-2">
                            {pillarSearchQuery
                              ? t('productKnowledgeDetail.modal.contentPillarNoMatch', 'Tidak ada pillar yang cocok')
                              : t('productKnowledgeDetail.modal.contentPillarEmpty', 'Tidak ada pillar aktif')}
                          </p>
                        );
                      }
                      return (
                        <div className="space-y-1">
                          {filtered.map((pillar) => {
                            const isSelected = formData.content_pillar_ids.includes(pillar.id);
                            return (
                              <div
                                key={pillar.id}
                                className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/80 cursor-pointer"
                                onClick={() => handlePillarToggle(pillar.id)}
                              >
                                <Checkbox
                                  id={`pkd-pillar-${pillar.id}`}
                                  checked={isSelected}
                                  onCheckedChange={() => handlePillarToggle(pillar.id)}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <label
                                  htmlFor={`pkd-pillar-${pillar.id}`}
                                  className="text-sm font-medium leading-snug cursor-pointer flex-1 select-none break-words"
                                >
                                  {pillar.name}
                                </label>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                  <div className="shrink-0 border-t bg-muted/30 p-2">
                    <p className="text-xs text-muted-foreground">
                      {t(
                        'productKnowledgeDetail.modal.contentPillarMultiHint',
                        'Bisa pilih beberapa pillar; hapus tag dengan × tanpa buka daftar.',
                      )}
                    </p>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="product_knowledge_title">
              {t('productKnowledgeDetail.modal.title', 'Target Market')}
            </Label>
            <Input
              id="product_knowledge_title"
              value={formData.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder={t(
                'productKnowledgeDetail.modal.titlePlaceholder',
                'Contoh: Pasangan milenial 28–35, urban',
              )}
              maxLength={200}
              className="text-base"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="product_knowledge_perspective">
              {t('productKnowledgeDetail.modal.perspective', 'Dari Perspective')}
            </Label>
            <Textarea
              id="product_knowledge_perspective"
              value={formData.perspective}
              onChange={(e) => handlePerspectiveChange(e.target.value)}
              placeholder={t(
                'productKnowledgeDetail.modal.perspectivePlaceholder',
                'Sudut pandang atau konteks singkat (opsional)',
              )}
              rows={3}
              className="resize-none text-base"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="product_knowledge_content">
              {t('productKnowledgeDetail.modal.content', 'Creative Content')} *
            </Label>
            <Textarea
              id="product_knowledge_content"
              value={formData.product_knowledge_content}
              onChange={(e) => handleContentChange(e.target.value)}
              placeholder={t(
                'productKnowledgeDetail.modal.contentPlaceholder',
                'Enter creative content...',
              )}
              rows={10}
              className="resize-none"
              required
            />
          </div>

          </DialogFormScrollArea>

          <DialogFooter className="shrink-0 border-t bg-background pt-4">
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
