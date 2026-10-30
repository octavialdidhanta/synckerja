import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { cn } from '@/shared/lib/utils';
import { isGeminiBillingNoticeError } from '@/shared/ai/geminiSpendCap';
import { toast } from 'sonner';
import {
  generateBriefSceneImageFile,
  type StoryboardFilmContext,
} from '@/6-1-dashboard/lib/generateBriefSceneImage';
import { useDigitalAssetCharactersListQuery } from '@/6-1-social-media-settings/hooks/useDigitalAssetsListQueries';

export function BriefSceneGenerateButton({
  rowIndex,
  headers,
  row,
  imageColumnIndex,
  planId,
  film,
  characterIds = [],
  onUploadImages,
  mediaBusy = false,
  isUploading = false,
  isDeleting = false,
  className,
  onGeneratingChange,
}: {
  rowIndex: number;
  headers: string[];
  row: string[];
  imageColumnIndex: number;
  planId?: string;
  film?: StoryboardFilmContext;
  characterIds?: string[];
  onUploadImages?: (rowIndex: number, files: File[]) => Promise<unknown>;
  mediaBusy?: boolean;
  isUploading?: boolean;
  isDeleting?: boolean;
  className?: string;
  onGeneratingChange?: (generating: boolean) => void;
}) {
  const { t } = useAppTranslation();
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);
  const { data: characters = [] } = useDigitalAssetCharactersListQuery();
  const characterNamesById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const character of characters) {
      map[character.id] = character.name || character.id.slice(0, 8);
    }
    return map;
  }, [characters]);

  const hasSceneText = headers.some(
    (_, colIdx) => colIdx !== imageColumnIndex && String(row[colIdx] ?? '').trim(),
  );
  const canGenerate =
    Boolean(planId && onUploadImages) &&
    hasSceneText &&
    !mediaBusy &&
    !isUploading &&
    !isDeleting &&
    !isGenerating;

  if (!planId || !onUploadImages) return null;

  const setGenerating = (value: boolean) => {
    setIsGenerating(value);
    onGeneratingChange?.(value);
  };

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setGenerating(true);
    try {
      const result = await generateBriefSceneImageFile({
        characterIds,
        characterNamesById,
        headers,
        row,
        imageColumnIndex,
        t,
        film,
        planId,
        rowIndex,
      });
      if (result.truncated) {
        toast.message(
          t(
            'briefDialog.layout.poseRefsTruncated',
            'Sent {{included}} of {{total}} pose photos (payload limit).',
            { included: result.included, total: result.totalAvailable },
          ),
        );
      }
      await onUploadImages(rowIndex, [result.file]);
      toast.success(t('briefDialog.layout.generateSuccess', 'Scene image generated.'));
    } catch (err) {
      console.error(err);
      if (isGeminiBillingNoticeError(err)) return;
      const msg =
        err instanceof Error
          ? err.message
          : t('briefDialog.layout.generateFailed', 'Image generation failed.');
      toast.error(msg);
    } finally {
      if (planId) void queryClient.invalidateQueries({ queryKey: ["content-ai-usage", planId] });
      setGenerating(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn('h-8 w-full gap-1.5 border-gray-300 text-xs', className)}
      disabled={!canGenerate}
      onClick={() => void handleGenerate()}
    >
      {isGenerating ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Sparkles className="h-3.5 w-3.5" />
      )}
      {isGenerating
        ? t('briefDialog.layout.generating', 'Generating…')
        : t('briefDialog.layout.generateImage', 'Generate image')}
    </Button>
  );
}
