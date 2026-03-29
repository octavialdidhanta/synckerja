
import React, { useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Textarea } from '@/shared/components/ui/textarea';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Label } from '@/shared/components/ui/label';
import { PlusCircle } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/shared/components/ui/use-toast';
import { useMotivations } from './useMotivations';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { applyVariables } from '@/shared/i18n/translations';

interface ModalMotivationFormProps {
  isOpen: boolean;
  onClose: () => void;
  profileName?: string;
  editingMotivation?: any;
}

export const ModalMotivationForm = ({ isOpen, onClose, profileName, editingMotivation }: ModalMotivationFormProps) => {
  const { t } = useAppTranslation();
  const [motivation, setMotivation] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { saveMotivation, updateMotivation, isLoading, employeeData, employeeError } = useMotivations();

  // Set form data when editing
  useEffect(() => {
    if (editingMotivation) {
      setMotivation(editingMotivation.content);
      setIsAnonymous(editingMotivation.is_anonymous);
    } else {
      setMotivation('');
      setIsAnonymous(false);
    }
  }, [editingMotivation]);

  const handleSubmit = async () => {
    if (!motivation.trim()) {
      toast({
        title: t('common.error', 'Error'),
        description: t('motivation.pleaseWriteFirst', 'Please write motivation first'),
        variant: "destructive",
      });
      return;
    }

    // Check if organization data is ready
    if (!employeeData?.organization_id) {
      toast({
        title: t('common.error', 'Error'),
        description: t('motivation.organizationNotReady', 'Organization data is not ready. Please try again in a few seconds.'),
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingMotivation) {
        await updateMotivation(editingMotivation.id, motivation, isAnonymous, profileName);
        toast({
          title: t('common.success', 'Success'),
          description: t('motivation.updatedSuccessfully', 'Motivation updated successfully'),
        });
      } else {
        await saveMotivation(motivation, isAnonymous, profileName);
        toast({
          title: t('common.success', 'Success'),
          description: t('motivation.addedSuccessfully', 'Motivation added successfully'),
        });
      }

      // Reset form
      setMotivation('');
      setIsAnonymous(false);
      onClose();
    } catch (error) {
      console.error('Error saving motivation:', error);
      let errorMessage = t('motivation.failedToAdd', 'Failed to add motivation');
      if (error instanceof Error) {
        // Translate specific error messages
        if (error.message.includes('Gagal memeriksa batas harian') || error.message.includes('Failed to check daily limit')) {
          errorMessage = t('motivation.failedToCheckDailyLimit', 'Failed to check daily limit');
        } else if (error.message.includes('sudah menulis 2 motivasi') || error.message.includes('daily limit reached')) {
          errorMessage = t('motivation.dailyLimitReached', 'You have already written 2 motivations today. Daily limit reached.');
        } else if (error.message.includes('Organization not found')) {
          errorMessage = t('motivation.organizationNotFound', 'Organization not found. Please ensure you are logged in and have selected an organization.');
        } else {
          errorMessage = error.message;
        }
      }
      toast({
        title: t('common.error', 'Error'), 
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const authorName = isAnonymous ? "Unknown" : (profileName || "Unknown");

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <PlusCircle className="h-5 w-5 text-primary" />
            {editingMotivation ? t('motivation.editMotivation', 'Edit Motivation') : t('motivation.writeMotivation', 'Write Motivation')}
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-600">
            {t('motivation.description', 'Write a motivational message to share with the team or edit a previously created motivation.')}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="motivation" className="text-sm font-semibold">{t('motivation.motivation', 'Motivation')}</Label>
            <Textarea
              id="motivation"
              placeholder={t('motivation.placeholder', 'Write an inspiring motivation...')}
              value={motivation}
              onChange={(e) => setMotivation(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="anonymous"
              checked={isAnonymous}
              onCheckedChange={(checked) => setIsAnonymous(checked as boolean)}
            />
            <Label htmlFor="anonymous" className="text-sm">
              {t('motivation.postAsAnonymous', 'Post as Unknown (anonymous)')}
            </Label>
          </div>

          <div className="text-sm text-muted-foreground">
            {t('motivation.willAppearAs', 'Will appear as')}: <span className="font-medium">{applyVariables(t('motivation.displayFormat', '{{motivation}} - {{authorName}}'), { motivation: '...', authorName })}</span>
          </div>

          {isLoading && (
            <div className="text-sm text-blue-600 bg-blue-50 p-2 rounded">
              {t('motivation.loadingOrganization', 'Loading organization data...')}
            </div>
          )}

          {employeeError && (
            <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
              {t('motivation.errorLoadingOrganization', 'Error loading organization data. Please refresh the page.')}
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={isSubmitting || isLoading || !employeeData?.organization_id}
            >
              {isSubmitting ? t('motivation.saving', 'Saving...') : (editingMotivation ? t('motivation.updateMotivation', 'Update Motivation') : t('motivation.addMotivation', 'Add Motivation'))}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
