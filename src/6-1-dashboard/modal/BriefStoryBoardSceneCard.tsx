import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Check, Copy, MoreVertical, Plus, Trash2 } from 'lucide-react';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { cn } from '@/shared/lib/utils';
import { BriefStoryboardImageCell } from './BriefStoryboardImageCell';
import { BriefMasterVideoButton } from './briefVideoContext';
import { BriefNarrationPlay, BriefSeedanceVoiceButton, BriefVoiceOverActions } from './briefVoiceContext';
import { BriefSceneGenerateButton } from './BriefSceneGenerateButton';
import { BriefMentionField, BriefMentionText } from './BriefMentionField';
import { BriefImagePromptDialog } from './BriefImagePromptDialog';
import { BriefVersionPager } from './BriefVersionPager';
import { activeVoSlide, savedVoSlides, type BriefVoVersions } from './briefVoVersions';
import {
  briefAuditField,
  pairedSceneSlides,
  pairedSceneValue,
  pairedVeoIndex,
  type BriefAuditField,
  type BriefFieldDraft,
  type BriefFieldVersions,
} from './briefFieldVersions';
import type { BriefImageSceneVersion } from '@/6-1-dashboard/hook/useBriefStoryboardImages';
import { isBriefVoHeader } from './briefStoryboardConstants';
import type { BriefStoryboardImageWithUrl } from '@/6-1-dashboard/hook/useBriefStoryboardImages';
import type { StoryboardFilmContext } from '@/6-1-dashboard/lib/generateBriefSceneImage';
import type { BriefConceptDocument } from '@/6-1-dashboard/modal/briefConceptAssets';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
const storyboardFieldBoxClass =
  'min-w-0 w-full cursor-default select-text rounded border border-gray-200 bg-gray-50 px-1.5 py-1 text-sm text-gray-600';

function StoryBoardFieldValue({
  value,
  concept,
}: {
  value: string;
  concept?: BriefConceptDocument | null;
}) {
  const trimmed = value.trim();
  return (
    <div className={storyboardFieldBoxClass}>
      {trimmed ? (
        <BriefMentionText value={value} concept={concept} className="block whitespace-pre-wrap break-words" />
      ) : (
        <span className="text-gray-400">—</span>
      )}
    </div>
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
  voVersions?: BriefVoVersions[];
  voSlide?: number;
  onSelectVoSlide?: (index: number) => void;
  narrationPlay?: {
    rowIndex: number;
    slides: string[];
    activeIndex: number;
    onSelect: (index: number) => void;
  } | null;
  fieldVersions?: BriefFieldVersions[];
  fieldSlide?: Record<string, number>;
  fieldDrafts?: Record<string, BriefFieldDraft>;
  onSelectFieldSlide?: (field: BriefAuditField, index: number) => void;
  onFieldDraft?: (field: BriefAuditField, index: number, text: string) => void;
  onCommitScene?: (version: BriefImageSceneVersion) => void;
  activeImageId?: string | null;
  onActiveImageIdChange?: (imageId: string) => void;
  masterPromptText?: string;
  onUpdateCell: (rowIndex: number, cellIdx: number, value: string) => void;
  onUploadImages?: (rowIndex: number, files: File[], promptOverride?: string | BriefImageSceneVersion | null) => Promise<unknown>;
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
  voVersions = [],
  voSlide,
  onSelectVoSlide,
  narrationPlay = null,
  onCommitScene,
  activeImageId: activeImageIdProp = null,
  onActiveImageIdChange,
  masterPromptText,
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
  const [localActiveImageId, setLocalActiveImageId] = useState<string | null>(null);
  const activeImageId = onActiveImageIdChange ? activeImageIdProp : localActiveImageId;
  const selectActiveImage = (imageId: string) => {
    if (onActiveImageIdChange) onActiveImageIdChange(imageId);
    else setLocalActiveImageId(imageId);
  };
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
  const masterPrompt = masterPromptText ?? (masterPromptColumnIndex >= 0 ? (row[masterPromptColumnIndex] ?? '') : '');
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
          : 'w-[360px] max-h-[max(85vh,46rem)]',
      )}
    >
      <div className="sticky top-0 z-20 flex shrink-0 items-center justify-between gap-1 border-b border-gray-200 bg-gray-50 px-2 py-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <span className="min-w-0 truncate text-xs font-semibold text-gray-700">
            {t('briefDialog.layout.sceneShoot', 'Scene {{scene}} - Shoot {{shoot}}', {
              scene: sceneNumber,
              shoot: shootNumber,
            })}
          </span>
          {narrationPlay ? (
            <BriefNarrationPlay
              rowIndex={narrationPlay.rowIndex}
              slides={narrationPlay.slides}
              activeIndex={narrationPlay.activeIndex}
              onSelect={narrationPlay.onSelect}
            />
          ) : null}
        </div>
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
            ? 'min-w-0 overflow-x-hidden'
            : 'min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto scrollbar-hide [touch-action:pan-x_pan-y] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
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
          onActiveImageIdChange={selectActiveImage}
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

        <div className="grid w-full min-w-0 max-w-full grid-cols-[auto_minmax(0,1fr)] items-start gap-x-2 gap-y-1.5">
          {textColumns.map(({ header, colIdx }) => {
            const value = row[colIdx] ?? '';
            const voiceHeader = isBriefVoHeader(header);
            const voiceSlides = voiceHeader ? savedVoSlides(voVersions, rowIndex, value) : [];
            const voiceActive = activeVoSlide(voSlide, voiceSlides.length);
            const voiceEditingLatest = isEditing && voiceActive >= voiceSlides.length - 1;
            const voiceText = voiceSlides.length > 1 && !voiceEditingLatest ? (voiceSlides[voiceActive] ?? value) : value;
            const auditField = briefAuditField(header);
            const auditView = auditField
              ? (() => {
                  const slides = pairedSceneSlides(value, images, auditField);
                  const active = pairedVeoIndex(images, activeImageId);
                  return { slides, active, text: slides[active] ?? value };
                })()
              : null;
            const auditText = auditView?.text ?? value;
            return (
              <React.Fragment key={colIdx}>
                <span className="whitespace-nowrap pt-0.5 text-[11px] font-semibold text-gray-500">
                  {header}:
                </span>
                <div className="min-w-0 max-w-full overflow-x-hidden">
                  {auditView && auditField ? (
                    <div className="min-w-0">
                      <StoryBoardFieldValue value={auditText} concept={film?.concept} />
                      <BriefVersionPager
                        count={auditView.slides.length}
                        activeIndex={auditView.active}
                        onSelect={(index) => {
                          const image = images[index];
                          if (image?.id) selectActiveImage(image.id);
                        }}
                      />
                    </div>
                  ) : voiceSlides.length > 1 ? (
                    <div className="min-w-0">
                      {voiceEditingLatest ? (
                        <BriefMentionField
                          value={value}
                          minRows={1}
                          concept={film?.concept}
                          onChange={(next) => onUpdateCell(rowIndex, colIdx, next)}
                          className="min-w-0 w-full rounded border border-gray-200 bg-white px-1.5 py-0.5 text-sm text-gray-800 focus:border-blue-400 focus:outline-none"
                        />
                      ) : (
                        <StoryBoardFieldValue value={voiceText} concept={film?.concept} />
                      )}
                      <BriefVersionPager
                        count={voiceSlides.length}
                        activeIndex={voiceActive}
                        onSelect={(index) => onSelectVoSlide?.(index)}
                      />
                    </div>
                  ) : isEditing ? (
                    <BriefMentionField
                      value={value}
                      minRows={1}
                      concept={film?.concept}
                      onChange={(next) => onUpdateCell(rowIndex, colIdx, next)}
                      className="min-w-0 w-full rounded border border-gray-200 bg-white px-1.5 py-0.5 text-sm text-gray-800 focus:border-blue-400 focus:outline-none"
                    />
                  ) : (
                    <StoryBoardFieldValue value={value} concept={film?.concept} />
                  )}
                  {voiceHeader ? (
                    <BriefVoiceOverActions
                      rowIndex={rowIndex}
                      text={voiceText}
                      onChangeText={(next) => onUpdateCell(rowIndex, colIdx, next)}
                    />
                  ) : null}
                </div>
              </React.Fragment>
            );
          })}

          {masterPromptColumnIndex >= 0 && (isEditing || masterPrompt.trim()) ? (
            <>
              <span className="whitespace-nowrap pt-0.5 text-[11px] font-semibold text-gray-500">
                {headers[masterPromptColumnIndex]}:
              </span>
              <div className="min-w-0 max-w-full overflow-x-hidden">
                {masterPrompt.trim() ? (
                  <div className="mb-1 flex justify-end">
                    <BriefMasterVideoButton rowIndex={rowIndex} className="h-7 w-7 shrink-0 bg-white p-0" />
                    <BriefSeedanceVoiceButton rowIndex={rowIndex} scope="master" />
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
                <div
                  aria-disabled="true"
                  className={cn(storyboardFieldBoxClass, 'min-h-[60px] py-0.5')}
                >
                  <BriefMentionText
                    value={masterPrompt}
                    concept={film?.concept}
                    className="block whitespace-pre-wrap"
                  />
                </div>
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
        planId={planId}
        characterIds={characterIds}
        startingShot={pairedSceneValue(String(row[headers.findIndex((header) => briefAuditField(header) === 'shot')] ?? ''), images, 'shot', activeImageId)}
        startingAngle={pairedSceneValue(String(row[headers.findIndex((header) => briefAuditField(header) === 'angle')] ?? ''), images, 'angle', activeImageId)}
        startingVisual={pairedSceneValue(String(row[headers.findIndex((header) => briefAuditField(header) === 'visual')] ?? ''), images, 'visual', activeImageId)}
        startingPrompt={pairedSceneValue(String(row[headers.findIndex((header) => briefAuditField(header) === 'veo')] ?? ''), images, 'veo', activeImageId)}
        onUploadImages={onUploadImages}
        onClose={() => setPromptOpen(false)}
        onCreated={(imageId, version) => {
          if (imageId) selectActiveImage(imageId);
          onCommitScene?.(version);
        }}
      />
    </article>
  );
};
