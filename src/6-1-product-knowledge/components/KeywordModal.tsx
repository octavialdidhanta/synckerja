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
import { Input } from '@/shared/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { Hash, Plus, X, Trash2 } from 'lucide-react';
import { Keyword } from '../hooks/useKeywords';
import { useServices } from '../hooks/useServices';

interface KeywordItem {
  service_id: string;
  keyword: string;
  id?: string; // Temporary ID for list items
}

interface KeywordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: { service_id: string; keyword: string }) => Promise<void>;
  onSaveMultiple?: (data: KeywordItem[]) => Promise<void>;
  isLoading?: boolean;
  initialData?: Keyword | null;
  onSaveAndAddAnother?: (data: { service_id: string; keyword: string }) => Promise<void>;
  onSwitchToAddMode?: () => void;
}

export const KeywordModal: React.FC<KeywordModalProps> = ({
  open,
  onOpenChange,
  onSave,
  onSaveMultiple,
  isLoading = false,
  initialData = null,
  onSaveAndAddAnother,
  onSwitchToAddMode,
}) => {
  const { t } = useAppTranslation();
  const [serviceId, setServiceId] = useState('');
  const [keyword, setKeyword] = useState('');
  const [keywordsList, setKeywordsList] = useState<KeywordItem[]>([]);
  const { data: services = [] } = useServices();

  // Reset form when modal opens/closes or initialData changes
  useEffect(() => {
    if (open) {
      if (initialData) {
        // Edit mode - populate with existing data
        setServiceId(initialData.service_id ?? '');
        setKeyword(initialData.keyword || '');
        setKeywordsList([]); // Clear list in edit mode
      } else {
        // Create mode - reset form
        setServiceId('');
        setKeyword('');
        setKeywordsList([]); // Clear list when opening for new entry
      }
    } else {
      // Close modal - reset form
      setServiceId('');
      setKeyword('');
      setKeywordsList([]);
    }
  }, [open, initialData]);

  const handleAddToList = () => {
    const trimmedKeyword = (keyword || '').trim();
    if (!trimmedKeyword || !serviceId) {
      return;
    }

    // Check for duplicates
    const isDuplicate = keywordsList.some(
      (item) => item.service_id === serviceId && item.keyword.toLowerCase() === trimmedKeyword.toLowerCase()
    );

    if (isDuplicate) {
      return; // Don't add duplicate
    }

    // Add to list
    const newItem: KeywordItem = {
      service_id: serviceId,
      keyword: trimmedKeyword,
      id: `temp-${Date.now()}-${Math.random()}`,
    };

    setKeywordsList([...keywordsList, newItem]);
    // Clear input fields but keep service selected
    setKeyword('');
  };

  const handleRemoveFromList = (id?: string) => {
    if (!id) return;
    setKeywordsList(keywordsList.filter((item) => item.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // If in edit mode, save single keyword
    if (initialData) {
      const trimmedKeyword = (keyword || '').trim();
      if (!trimmedKeyword || !serviceId) {
        return;
      }

      try {
        await onSave({
          service_id: serviceId,
          keyword: trimmedKeyword,
        });
        // Reset form after successful save
        setServiceId('');
        setKeyword('');
        setKeywordsList([]);
      } catch (error) {
        // Error handling is done in parent component
        console.error('Error saving keyword:', error);
      }
      return;
    }

    // If multiple keywords mode and has list, save all (including current input if filled)
    const trimmedKeyword = (keyword || '').trim();
    const hasCurrentInput = trimmedKeyword && serviceId;
    
    if (keywordsList.length > 0 && onSaveMultiple) {
      // Add current input to list if it's filled and not duplicate
      let finalList = [...keywordsList];
      if (hasCurrentInput) {
        const isDuplicate = keywordsList.some(
          (item) => item.service_id === serviceId && item.keyword.toLowerCase() === trimmedKeyword.toLowerCase()
        );
        if (!isDuplicate) {
          finalList.push({
            service_id: serviceId,
            keyword: trimmedKeyword,
          });
        }
      }
      
      try {
        await onSaveMultiple(finalList);
        // Reset form after successful save
        setServiceId('');
        setKeyword('');
        setKeywordsList([]);
      } catch (error) {
        // Error handling is done in parent component
        console.error('Error saving keywords:', error);
      }
      return;
    }

    // Fallback to single save
    if (!hasCurrentInput) {
      return;
    }

    try {
      await onSave({
        service_id: serviceId,
        keyword: trimmedKeyword,
      });
      // Reset form after successful save
      setServiceId('');
      setKeyword('');
      setKeywordsList([]);
    } catch (error) {
      // Error handling is done in parent component
      console.error('Error saving keyword:', error);
    }
  };

  const handleSaveAndAddAnother = async (e: React.MouseEvent) => {
    e.preventDefault();
    const trimmedKeyword = (keyword || '').trim();
    if (!trimmedKeyword || !serviceId) {
      return;
    }

    try {
      if (onSaveAndAddAnother) {
        await onSaveAndAddAnother({
          service_id: serviceId,
          keyword: trimmedKeyword,
        });
        // Reset form for next entry
        setServiceId('');
        setKeyword('');
      } else {
        // Fallback to regular save if onSaveAndAddAnother not provided
        await onSave({
          service_id: serviceId,
          keyword: trimmedKeyword,
        });
        setServiceId('');
        setKeyword('');
      }
    } catch (error) {
      // Error handling is done in parent component
      console.error('Error saving keyword:', error);
    }
  };

  const handleCancel = () => {
    setServiceId('');
    setKeyword('');
    onOpenChange(false);
  };

  const handleResetForm = () => {
    setServiceId('');
    setKeyword('');
    setKeywordsList([]);
  };

  const getServiceName = (serviceId: string) => {
    return services.find((s) => s.id === serviceId)?.name || serviceId;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <DialogTitle className="flex items-center gap-2">
                <Hash className="h-5 w-5 text-gray-700" />
                {initialData
                  ? t('productKnowledge.keywords.modal.editTitle', 'Edit Keyword')
                  : t('productKnowledge.keywords.modal.title', 'Add New Keyword')}
              </DialogTitle>
              <DialogDescription>
                {initialData
                  ? t(
                      'productKnowledge.keywords.modal.editDescription',
                      'Update the keyword information'
                    )
                  : t(
                      'productKnowledge.keywords.modal.description',
                      'Create a new keyword for SEO optimization. You can add multiple keywords at once.'
                    )}
              </DialogDescription>
            </div>
            <div className="flex gap-2">
              {initialData && onSwitchToAddMode && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    handleResetForm();
                    onSwitchToAddMode();
                  }}
                  disabled={isLoading}
                  className="ml-2"
                  title={t('productKnowledge.keywords.modal.addNewKeyword', 'Add new keyword')}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {t('productKnowledge.keywords.modal.addNew', 'Add New')}
                </Button>
              )}
              {!initialData && (serviceId || keyword || keywordsList.length > 0) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleResetForm}
                  disabled={isLoading}
                  className="ml-2"
                  title={t('productKnowledge.keywords.modal.resetForm', 'Reset form')}
                >
                  <X className="h-4 w-4 mr-1" />
                  {t('productKnowledge.keywords.modal.clear', 'Clear')}
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="space-y-4 py-4 flex-1 overflow-y-auto">
            {/* Service */}
            <div className="space-y-2">
              <Label htmlFor="keyword-service">
                {t('productKnowledge.keywords.modal.serviceLabel', 'Service')} *
              </Label>
              <Select
                value={serviceId}
                onValueChange={setServiceId}
                disabled={isLoading}
                required={keywordsList.length === 0}
              >
                <SelectTrigger id="keyword-service">
                  <SelectValue placeholder={t('productKnowledge.keywords.modal.servicePlaceholder', 'Select service')} />
                </SelectTrigger>
                <SelectContent>
                  {services
                    .filter((service) => service?.name && service?.id)
                    .map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Keyword Input */}
            <div className="space-y-2">
              <Label htmlFor="keyword-text">
                {t('productKnowledge.keywords.modal.keywordLabel', 'Keyword')} *
              </Label>
              <div className="flex gap-2">
                <Input
                  id="keyword-text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !initialData && keyword.trim() && serviceId) {
                      e.preventDefault();
                      handleAddToList();
                    }
                  }}
                  placeholder={t('productKnowledge.keywords.modal.keywordPlaceholder', 'Enter keyword (e.g., SEO TikTok, Digital Marketing)')}
                  disabled={isLoading}
                  className="flex-1"
                />
                {!initialData && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddToList}
                    disabled={isLoading || !keyword.trim() || !serviceId}
                    className="flex-shrink-0"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    {t('productKnowledge.keywords.modal.addToList', 'Add')}
                  </Button>
                )}
              </div>
              {!initialData && (
                <p className="text-xs text-gray-500">
                  {t('productKnowledge.keywords.modal.addToListHint', 'Press Enter or click Add to add keyword to list')}
                </p>
              )}
            </div>

            {/* Keywords List */}
            {!initialData && keywordsList.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>
                    {t('productKnowledge.keywords.modal.keywordsList', 'Keywords to Add')} ({keywordsList.length})
                  </Label>
                </div>
                <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                  {keywordsList.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {item.keyword}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {getServiceName(item.service_id)}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveFromList(item.id)}
                        disabled={isLoading}
                        className="ml-2 h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 flex-shrink-0 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isLoading}
              className="w-full sm:w-auto"
            >
              {t('productKnowledge.keywords.modal.cancel', 'Cancel')}
            </Button>
            {!initialData && keywordsList.length > 0 && (
              <Button
                type="submit"
                disabled={isLoading || keywordsList.length === 0}
                className="w-full sm:w-auto"
              >
                {isLoading
                  ? t('productKnowledge.keywords.modal.saving', 'Saving...')
                  : t('productKnowledge.keywords.modal.saveAll', 'Save All') + ` (${keywordsList.length})`}
              </Button>
            )}
            {(!initialData && keywordsList.length === 0) || initialData ? (
              <Button
                type="submit"
                disabled={isLoading || !keyword.trim() || !serviceId}
                className="w-full sm:w-auto"
              >
                {isLoading
                  ? t('productKnowledge.keywords.modal.saving', 'Saving...')
                  : t('productKnowledge.keywords.modal.save', 'Save')}
              </Button>
            ) : null}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

