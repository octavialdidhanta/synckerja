import React, { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { parseAIScriptOutput } from '../utils/parseAIScriptOutput';
import { getCaptionFallback } from '../utils/parseScriptSections';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';

interface SaveToPlanPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  script: string;
  saveBrief: boolean;
  saveCaption: boolean;
  saveConcept?: boolean;
}

export const SaveToPlanPreviewDialog: React.FC<SaveToPlanPreviewDialogProps> = ({
  open,
  onOpenChange,
  script,
  saveBrief,
  saveCaption,
  saveConcept = false,
}) => {
  const { t } = useAppTranslation();

  const { brief, caption: parsedCaption, concept } = useMemo(
    () => parseAIScriptOutput(script),
    [script]
  );
  const caption = useMemo(
    () => parsedCaption.trim() || getCaptionFallback(script),
    [script, parsedCaption]
  );

  const showAny = saveBrief || saveCaption || saveConcept;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        style={{ zIndex: 999999 }}
      >
        <DialogHeader>
          <DialogTitle>
            {t('scriptGenerator.saveToPlanModal.previewTitle', 'Preview - Brief, Caption & Concept')}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto seamless-scroll space-y-4 py-2">
          {!showAny ? (
            <p className="text-sm text-muted-foreground">
              {t('scriptGenerator.saveToPlanModal.previewEmpty', 'Select Brief, Caption or Concept to view preview')}
            </p>
          ) : (
            <>
              {saveConcept && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">
                    {t('scriptGenerator.saveToPlanModal.saveConcept', 'Save Concept')}
                  </h4>
                  <pre className="text-sm whitespace-pre-wrap rounded-md border bg-muted/50 p-3 max-h-[200px] overflow-y-auto">
                    {concept.trim() || '-'}
                  </pre>
                </div>
              )}
              {saveBrief && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">
                    {t('scriptGenerator.saveToPlanModal.saveBrief', 'Save Breakdown Script to Brief')}
                  </h4>
                  <pre className="text-sm whitespace-pre-wrap rounded-md border bg-muted/50 p-3 max-h-[200px] overflow-y-auto">
                    {brief.trim() || '-'}
                  </pre>
                </div>
              )}
              {saveCaption && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">
                    {t('scriptGenerator.saveToPlanModal.saveCaption', 'Save Caption')}
                  </h4>
                  <pre className="text-sm whitespace-pre-wrap rounded-md border bg-muted/50 p-3 max-h-[200px] overflow-y-auto">
                    {caption.trim() || '-'}
                  </pre>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
