import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Check, Copy, MoreVertical, Plus, Trash2 } from 'lucide-react';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { cn } from '@/shared/lib/utils';
import { BriefStoryboardImageCell } from './BriefStoryboardImageCell';
import { BriefMasterVideoButton } from './briefVideoContext';
import { BriefSceneGenerateButton } from './BriefSceneGenerateButton';
import { BriefMentionField, BriefMentionText } from './BriefMentionField';
import { BriefImagePromptDialog } from './BriefImagePromptDialog';
import { BriefVeoPromptSlides } from './BriefVeoPromptSlides';
import { isVeoPromptHeader, veoColumnUsesSlides } from '@/6-1-dashboard/lib/seedanceVideo';
import type { BriefStoryboardImageWithUrl } from '@/6-1-dashboard/hook/useBriefStoryboardImages';
import type { StoryboardFilmContext } from '@/6-1-dashboard/lib/generateBriefSceneImage';
import type { BriefConceptDocument } from '@/6-1-dashboard/modal/briefConceptAssets';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';

function StoryBoardFieldValue({
  value,
  label,
  viewFullLabel,
  concept,
}: {
  value: string;
  label: string;
  viewFullLabel: string;
  concept?: BriefConceptDocument | null;
}) {
  const [open, setOpen] = useState(false);
  const trimmed = value.trim();

  if (!trimmed) {
    return <span className="min-w-0 flex-1 text-sm text-gray-400">—</span>;
  }

  if (!open) {
    return (
      <button
        type="button"
        title={viewFullLabel}
        aria-label={`${label}: ${trimmed}. ${viewFullLabel}`}
        className={cn(
          'min-w-0 flex-1 overflow-x-auto text-left text-sm text-gray-700',
          'whitespace-nowrap [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          'cursor-pointer rounded px-0.5 hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-400',
        )}
        onClick={() => setOpen(true)}
      >
        <BriefMentionText value={value.replace(/\n/g, ' ')} concept={concept} />
      </button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={viewFullLabel}
          aria-label={`${label}: ${trimmed}. ${viewFullLabel}`}
          className={cn(
            'min-w-0 flex-1 overflow-x-auto text-left text-sm text-gray-700',
            'whitespace-nowrap [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
            'cursor-pointer rounded px-0.5 hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-400',
          )}
        >
          <BriefMentionText value={value.replace(/\n/g, ' ')} concept={concept} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        className="max-w-[min(320px,90vw)] whitespace-pre-wrap break-words p-3 text-sm leading-relaxed"
        style={{ zIndex: 999999 }}
      >
        <BriefMentionText value={value} concept={concept} />
      </PopoverContent>
    </Popover>
  );
}



export interface BriefStoryBoardSceneCardProps {
  rowIndex: number;
  sceneNumber: number;
  shootNumber: string;
  headers: string[];
  row: string[];
  imageColumnIndex: number;
  images: BriefStoryboardImageWithUrl[];
  isEditing: boolean;
  showRowActions: boolean;
  mediaBusy?: boolean;
  isUploading?: boolean;
  isDeleting?: boolean;
  planId?: string;
  film?: StoryboardFilmContext;
  characterIds?: string[];
  onCharacterIdsChange?: (rowIndex: number, characterIds: string[]) => void;
  onUpdateCell: (rowIndex: number, cellIdx: number, value: string) => void;
  onUploadImages?: (rowIndex: number, files: File[], promptOverride?: string | null) => Promise<unknown>;
  onDeleteImage?: (imageId: string) => Promise<unknown>;
  onAddRow?: (rowIndex: number) => void;
  onAddSequenceAfterRow?: (rowIndex: number) => void;
  onDeleteRow?: (rowIndex: number) => void;
  onMoveToPreviousSequence?: (rowIndex: number) => void;
  onMoveToNextSequence?: (rowIndex: number) => void;
  canMoveToPreviousSequence?: boolean;
  canMoveToNextSequence?: boolean;
  density?: 'desktop' | 'mobile-2col';
}

export const BriefStoryBoardSceneCard: React.FC<BriefStoryBoardSceneCardProps> = ({
  rowIndex,
  sceneNumber,
  shootNumber,
  headers,
  row,
  imageColumnIndex,
  images,
  isEditing,
  showRowActions,
  mediaBusy = false,
  isUploading = false,
  isDeleting = false,
  planId,
  film,
  characterIds = [],
  onUpdateCell,
  onUploadImages,
  onDeleteImage,
  onAddRow,
  onAddSequenceAfterRow,
  onDeleteRow,
  onMoveToPreviousSequence,
  onMoveToNextSequence,
  canMoveToPreviousSequence = false,
  canMoveToNextSequence = false,
  density = 'desktop',
}) => {
  const { t } = useAppTranslation();
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeImageId, setActiveImageId] = useState<string | null>(null);
  const [promptOpen, setPromptOpen] = useState(false);
  const [masterPromptCopied, setMasterPromptCopied] = useState(false);
  const copiedTimer = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (copiedTimer.current) window.clearTimeout(copiedTimer.current);
    };
  }, []);
  const isMasterPromptHeader = (header: string) => header.trim().toLowerCase() === 'master prompt';
  const masterPromptColumnIndex = headers.findIndex(isMasterPromptHeader);
  const masterPrompt = masterPromptColumnIndex >= 0 ? (row[masterPromptColumnIndex] ?? '') : '';
  const textColumns = headers
    .map((header, colIdx) => ({ header, colIdx }))
    .filter(({ header, colIdx }) => colIdx !== imageColumnIndex && !isMasterPromptHeader(header));
  const copyMasterPrompt = async () => {
    if (!masterPrompt.trim()) return;
    try {
      await navigator.clipboard.writeText(masterPrompt);
    } catch {
      return;
    }
    setMasterPromptCopied(true);
    if (copiedTimer.current) window.clearTimeout(copiedTimer.current);
    copiedTimer.current = window.setTimeout(() => setMasterPromptCopied(false), 1600);
  };

  return (
    <article
      className={cn(
        'flex shrink-0 flex-col overflow-hidden rounded-lg border-2 border-gray-300 bg-white [touch-action:pan-x_pan-y]',
        density === 'mobile-2col'
          ? 'w-[calc((100cqw-0.75rem)/1.25)] min-w-[calc((100cqw-0.75rem)/1.25)]'
          : 'w-[360px] max-h-[70vh]',
      )}
    >
      <div className="sticky top-0 z-20 flex shrink-0 items-center justify-between gap-2 border-b border-gray-200 bg-gray-50 px-2 py-1.5">
        <span className="text-xs font-semibold text-gray-700">
          {t('briefDialog.layout.sceneShoot', 'Scene {{scene}} - Shoot {{shoot}}', {
            scene: sceneNumber,
            shoot: shootNumber,
          })}
        </span>
        {showRowActions ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={mediaBusy || isGenerating}
                className="h-7 w-7 p-0 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                title={t('common.actions', 'Actions')}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onAddRow?.(rowIndex)} className="gap-2">
                <Plus className="h-4 w-4" />
                {t('briefDialog.addRow', 'Add row')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onAddSequenceAfterRow?.(rowIndex)}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                {t('briefDialog.layout.addSequence', 'Add sequence')}
              </DropdownMenuItem>
              {canMoveToPreviousSequence ? (
                <DropdownMenuItem onClick={() => onMoveToPreviousSequence?.(rowIndex)} className="gap-2">
                  {t('briefDialog.layout.moveToPreviousSequence', 'Move to previous sequence')}
                </DropdownMenuItem>
              ) : null}
              {canMoveToNextSequence ? (
                <DropdownMenuItem onClick={() => onMoveToNextSequence?.(rowIndex)} className="gap-2">
                  {t('briefDialog.layout.moveToNextSequence', 'Move to next sequence')}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem
                onClick={() => onDeleteRow?.(rowIndex)}
                className="gap-2 text-red-600 focus:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
                {t('briefDialog.deleteRow', 'Delete row')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      <div
        className={cn(
          'space-y-2 p-3',
          density === 'mobile-2col'
            ? 'overflow-visible'
            : 'min-h-0 flex-1 overflow-y-auto scrollbar-hide nested-scroll-touch-chain-xy [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        )}
      >
        <BriefStoryboardImageCell
          rowIndex={rowIndex}
          images={images}
          editable={Boolean(isEditing && planId)}
          disabled={
            !planId ||
            isGenerating ||
            (mediaBusy && !isUploading && !isDeleting) ||
            isUploading ||
            isDeleting
          }
          isUploading={isUploading || isGenerating}
          isDeleting={isDeleting}
          onUploadFiles={onUploadImages}
          onDeleteImage={onDeleteImage}
          activeImageId={activeImageId}
          onActiveImageIdChange={setActiveImageId}
          onEditPrompt={planId && film && onUploadImages ? () => setPromptOpen(true) : undefined}
          showUploadButton={Boolean(isEditing && planId)}
          uploadButtonLabel={t('briefDialog.layout.upload', 'Upload')}
        />

        <BriefSceneGenerateButton
          rowIndex={rowIndex}
          headers={headers}
          row={row}
          imageColumnIndex={imageColumnIndex}
          planId={planId}
          film={film}
          characterIds={characterIds}
          onUploadImages={onUploadImages}
          mediaBusy={mediaBusy}
          isUploading={isUploading}
          isDeleting={isDeleting}
          onGeneratingChange={setIsGenerating}
        />

        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-2 gap-y-1.5">
          {textColumns.map(({ header, colIdx }) => {
            const value = row[colIdx] ?? '';
            return (
              <React.Fragment key={colIdx}>
                <span className="whitespace-nowrap pt-0.5 text-[11px] font-semibold text-gray-500">
                  {header}:
                </span>
                {isVeoPromptHeader(header) && veoColumnUsesSlides(images) ? (
                  <BriefVeoPromptSlides
                    images={images}
                    activeImageId={activeImageId}
                    originalPrompt={value}
                    editable={isEditing}
                    concept={film?.concept}
                    onChangeOriginal={(next) => onUpdateCell(rowIndex, colIdx, next)}
                    onSelectImage={setActiveImageId}
                    minRows={1}
                    fieldClassName="min-w-0 w-full rounded border border-gray-200 bg-white px-1.5 py-0.5 text-sm text-gray-800 focus:border-blue-400 focus:outline-none"
                  />
                ) : isEditing ? (
                  <BriefMentionField
                    value={value}
                    minRows={1}
                    concept={film?.concept}
                    onChange={(next) => onUpdateCell(rowIndex, colIdx, next)}
                    className="min-w-0 w-full rounded border border-gray-200 bg-white px-1.5 py-0.5 text-sm text-gray-800 focus:border-blue-400 focus:outline-none"
                  />
                ) : (
                  <StoryBoardFieldValue
                    value={value}
                    label={header}
                    concept={film?.concept}
                    viewFullLabel={t('briefDialog.layout.viewFull', 'View full')}
                  />
                )}
              </React.Fragment>
            );
          })}

          {masterPromptColumnIndex >= 0 && (isEditing || masterPrompt.trim()) ? (
            <>
              <span className="whitespace-nowrap pt-0.5 text-[11px] font-semibold text-gray-500">
                {headers[masterPromptColumnIndex]}:
              </span>
              <div className="min-w-0">
                {masterPrompt.trim() ? (
                  <div className="mb-1 flex justify-end">
                    <BriefMasterVideoButton rowIndex={rowIndex} className="h-7 w-7 shrink-0 bg-white p-0" />
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 shrink-0 bg-white p-0"
                      aria-label={
                        masterPromptCopied
                          ? t('briefDialog.masterPromptCopied', 'Copied')
                          : t('briefDialog.copyMasterPrompt', 'Copy master prompt')
                      }
                      title={
                        masterPromptCopied
                          ? t('briefDialog.masterPromptCopied', 'Copied')
                          : t('briefDialog.copyMasterPrompt', 'Copy master prompt')
                      }
                      onClick={() => void copyMasterPrompt()}
                    >
                      {masterPromptCopied ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                      ) : (
                        <Copy className="h-3.5 w-3.5" aria-hidden />
                      )}
                    </Button>
                  </div>
                ) : null}
                {isEditing ? (
                  <BriefMentionField
                    value={masterPrompt}
                    minRows={2}
                    concept={film?.concept}
                    onChange={(next) => onUpdateCell(rowIndex, masterPromptColumnIndex, next)}
                    className="min-w-0 w-full rounded border border-gray-200 bg-white px-1.5 py-0.5 text-sm text-gray-800 focus:border-blue-400 focus:outline-none"
                  />
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      </div>
      <BriefImagePromptDialog
        open={promptOpen && Boolean(onUploadImages)}
        rowIndex={rowIndex}
        headers={headers}
        row={row}
        imageColumnIndex={imageColumnIndex}
        film={film}
        characterIds={characterIds}
        startingPrompt={(() => {
          const selected = images.find((image) => image.id === activeImageId) ?? images[0];
          return selected?.prompt_override ?? null;
        })()}
        onUploadImages={onUploadImages}
        onClose={() => setPromptOpen(false)}
        onCreated={(imageId) => {
          if (imageId) setActiveImageId(imageId);
        }}
      />
    </article>
  );
};
