
import { useState, useEffect, useCallback } from 'react';
import { debounce } from './optimizedHelpers';
import { useShowToast } from './useShowToast';

interface UseAutoSaveOptions {
  onSave: (data: any) => Promise<boolean>;
  delay?: number;
  enabledCondition?: boolean;
}

export const useAutoSave = ({ onSave, delay = 2000, enabledCondition = true }: UseAutoSaveOptions) => {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const showToast = useShowToast();

  const saveData = useCallback(async (data: any) => {
    if (!enabledCondition) return;
    
    setIsSaving(true);
    try {
      const success = await onSave(data);
      if (success) {
        setLastSaved(new Date());
        setHasUnsavedChanges(false);
        showToast({
          title: 'Saved',
          description: 'Changes saved automatically',
          variant: 'default'
        });
      } else {
        throw new Error('Save operation failed');
      }
    } catch (error) {
      console.error('Auto-save failed:', error);
      showToast({
        title: 'Save Failed',
        description: 'Failed to save changes. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  }, [onSave, enabledCondition, showToast]);

  const debouncedSave = useCallback(
    debounce(saveData, delay),
    [saveData, delay]
  );

  const triggerSave = useCallback((data: any) => {
    setHasUnsavedChanges(true);
    debouncedSave(data);
  }, [debouncedSave]);

  return {
    isSaving,
    lastSaved,
    hasUnsavedChanges,
    triggerSave
  };
};
