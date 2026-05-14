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
import { Textarea } from '@/shared/components/ui/textarea';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { Link2 } from 'lucide-react';
import { ProductKnowledgeHook } from '../hooks/useProductKnowledgeHooks';

interface HooksModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: { name: string; description?: string; hook_content?: string }) => Promise<void>;
  isLoading?: boolean;
  initialData?: ProductKnowledgeHook | null;
}

export const HooksModal: React.FC<HooksModalProps> = ({
  open,
  onOpenChange,
  onSave,
  isLoading = false,
  initialData = null,
}) => {
  const { t } = useAppTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [hookContent, setHookContent] = useState('');

  // Reset form when modal opens/closes or initialData changes
  useEffect(() => {
    if (open) {
      if (initialData) {
        // Edit mode - populate with existing data
        setName(initialData.name || '');
        setDescription(initialData.description || '');
        setHookContent(initialData.hook_content || '');
      } else {
        // Create mode - reset form
        setName('');
        setDescription('');
        setHookContent('');
      }
    } else {
      // Close modal - reset form
      setName('');
      setDescription('');
      setHookContent('');
    }
  }, [open, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = (name || '').trim();
    if (!trimmedName) {
      return;
    }

    try {
      const saveData: { name: string; description?: string; hook_content?: string } = {
        name: trimmedName,
      };
      
      if (description) {
        saveData.description = description.trim();
      }
      
      if (hookContent) {
        saveData.hook_content = hookContent.trim();
      }
      
      console.log('Saving hook data:', saveData);
      await onSave(saveData);
      // Reset form after successful save
      setName('');
      setDescription('');
      setHookContent('');
    } catch (error) {
      // Error handling is done in parent component
      console.error('Error saving hook:', error);
    }
  };

  const handleCancel = () => {
    setName('');
    setDescription('');
    setHookContent('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-gray-700" />
              {initialData
                ? t('productKnowledge.hooks.modal.editTitle', 'Edit Hook')
                : t('productKnowledge.hooks.modal.title', 'Add New Hook')}
            </DialogTitle>
            <DialogDescription>
              {initialData
                ? t(
                    'productKnowledge.hooks.modal.editDescription',
                    'Update the hook information'
                  )
                : t(
                    'productKnowledge.hooks.modal.description',
                    'Create a new hook for creative content'
                  )}
            </DialogDescription>
          </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Hook Name */}
            <div className="space-y-2">
              <Label htmlFor="hook-name">
                {t('productKnowledge.hooks.modal.nameLabel', 'Hook Name')} *
              </Label>
              <Input
                id="hook-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('productKnowledge.hooks.modal.namePlaceholder', 'Enter hook name')}
                disabled={isLoading}
                required
              />
            </div>

            {/* Hook Description */}
            <div className="space-y-2">
              <Label htmlFor="hook-description">
                {t('productKnowledge.hooks.modal.descriptionLabel', 'Description')}
              </Label>
              <Textarea
                id="hook-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t(
                  'productKnowledge.hooks.modal.descriptionPlaceholder',
                  'Enter hook description (optional)'
                )}
                disabled={isLoading}
                rows={4}
              />
            </div>

            {/* Hook Content */}
            <div className="space-y-2">
              <Label htmlFor="hook-content">
                {t('productKnowledge.hooks.modal.contentLabel', 'Hook Content')}
              </Label>
              <Textarea
                id="hook-content"
                value={hookContent}
                onChange={(e) => setHookContent(e.target.value)}
                placeholder={t(
                  'productKnowledge.hooks.modal.contentPlaceholder',
                  'Enter hook content (optional)'
                )}
                disabled={isLoading}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isLoading}
            >
              {t('productKnowledge.hooks.modal.cancel', 'Cancel')}
            </Button>
            <Button type="submit" disabled={isLoading || !name.trim()}>
              {isLoading
                ? t('productKnowledge.hooks.modal.saving', 'Saving...')
                : t('productKnowledge.hooks.modal.save', 'Save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

