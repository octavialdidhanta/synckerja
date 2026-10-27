import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Plus } from 'lucide-react';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { cn } from '@/shared/lib/utils';
import { BriefStoryBoardSceneCard } from './BriefStoryBoardSceneCard';
import { BriefSequenceHeader } from './BriefSequenceHeader';
import type { BriefStoryboardImageWithUrl, BriefImageSceneVersion } from '@/6-1-dashboard/hook/useBriefStoryboardImages';
import type { BriefSequence } from './briefSequences';
import { getSequenceRowRanges } from './briefSequences';
import type { BriefSceneMeta } from './briefSceneMeta';
import type { BriefVoVersions } from './briefVoVersions';
import type { BriefAuditField, BriefFieldDraft, BriefFieldVersions } from './briefFieldVersions';
import { getSceneCharacterIds } from './briefSceneMeta';
import type { StoryboardFilmContext } from '@/6-1-dashboard/lib/generateBriefSceneImage';
import { readShotBrief, shootHeaderLabels, shootNumberFromShotLabel } from '@/6-1-dashboard/lib/seedanceVideo';
import { isBriefVoHeader } from './briefStoryboardConstants';
import { activeVoSlide, narrationAnchorRow, savedVoSlides } from './briefVoVersions';

/** Show the bottom bar only after the last sequence/card is reached. */
export function useHideOnScrollDown(
  scrollRef: React.RefObject<HTMLElement | null>,
  enabled: boolean,
  contentKey?: string | number,
) {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (!enabled) {
      setHidden(false);
      return;
    }
    const el = scrollRef.current;
    if (!el) return;

    const sync = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const canScroll = scrollHeight > clientHeight + 8;
      const atEnd = scrollTop + clientHeight >= scrollHeight - 16;
      setHidden(canScroll ? !atEnd : false);
    };

    sync();
    el.addEventListener('scroll', sync, { passive: true });
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => {
      el.removeEventListener('scroll', sync);
      ro.disconnect();
    };
  }, [enabled, scrollRef, contentKey]);

  return hidden;
}

function SceneSlot({
  eager,
  widthClassName,
  children,
}: {
  eager: boolean;
  widthClassName: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(eager);

  useEffect(() => {
    if (shown) return;
    const node = ref.current;
    if (!node) return;
    const root = node.closest('[data-scene-scroll]');
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setShown(true);
      },
      { root: root instanceof Element ? root : null, rootMargin: '180px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [shown]);

  if (shown) return <>{children}</>;
  return <div ref={ref} className={cn('shrink-0', widthClassName)} aria-hidden />;
}

export interface BriefStoryBoardViewProps {
  headers: string[];
  bodyRows: string[][];
  imageColumnIndex: number;
  rowImagesMap: Record<number, BriefStoryboardImageWithUrl[]>;
  sequences: BriefSequence[];
  sceneMeta?: BriefSceneMeta[];
  voVersions?: BriefVoVersions[];
  voSlide?: Record<number, number>;
  onSelectVoSlide?: (rowIndex: number, index: number) => void;
  fieldVersions?: BriefFieldVersions[];
  fieldSlide?: Record<string, number>;
  fieldDrafts?: Record<string, BriefFieldDraft>;
  onSelectFieldSlide?: (rowIndex: number, field: BriefAuditField, index: number) => void;
  onFieldDraft?: (rowIndex: number, field: BriefAuditField, index: number, text: string) => void;
  onCommitScene?: (rowIndex: number, version: BriefImageSceneVersion) => void;
  activeImageIds?: Record<number, string | null | undefined>;
  onActiveImageIdChange?: (rowIndex: number, imageId: string) => void;
  masterPromptByRow?: Record<number, string>;
  isEditing: boolean;
  showRowActions: boolean;
  planId?: string;
  film?: StoryboardFilmContext;
  mediaBusy?: boolean;
  uploadingRowIndex?: number | null;
  deletingImageId?: string | null;
  onUpdateCell: (rowIndex: number, cellIdx: number, value: string) => void;
  onUploadImages?: (rowIndex: number, files: File[], promptOverride?: string | BriefImageSceneVersion | null) => Promise<unknown>;
  onDeleteImage?: (imageId: string) => Promise<unknown>;
  onAddRow?: (rowIndex: number) => void;
  onAddSequenceAfterRow?: (rowIndex: number) => void;
  onDeleteRow?: (rowIndex: number) => void;
  onSceneCharacterIdsChange?: (rowIndex: number, characterIds: string[]) => void;
  onRenameSequence?: (sequenceId: string, name: string) => void;
  onAddSequenceBelow?: () => void;
  onDeleteSequence?: (sequenceId: string) => void;
  onAddRowInSequence?: (sequenceId: string) => void;
  onMoveToPreviousSequence?: (rowIndex: number) => void;
  onMoveToNextSequence?: (rowIndex: number) => void;
  density?: 'desktop' | 'mobile-2col';
  workAreaExpanded?: boolean;
  /** Phone storyboard: no outer sequence panel around the cards. */
  bare?: boolean;
  /** Phone brief: image cell offers camera and gallery. */
  phoneImageSource?: boolean;
  className?: string;
}

export const BriefStoryBoardView: React.FC<BriefStoryBoardViewProps> = ({
  headers,
  bodyRows,
  imageColumnIndex,
  rowImagesMap,
  sequences,
  sceneMeta = [],
  voVersions = [],
  voSlide = {},
  onSelectVoSlide,
  fieldVersions = [],
  fieldSlide = {},
  fieldDrafts = {},
  onSelectFieldSlide,
  onFieldDraft,
  onCommitScene,
  activeImageIds = {},
  onActiveImageIdChange,
  masterPromptByRow = {},
  isEditing,
  showRowActions,
  planId,
  film,
  mediaBusy = false,
  uploadingRowIndex = null,
  deletingImageId = null,
  onUpdateCell,
  onUploadImages,
  onDeleteImage,
  onAddRow,
  onAddSequenceAfterRow,
  onDeleteRow,
  onSceneCharacterIdsChange,
  onRenameSequence,
  onAddSequenceBelow,
  onDeleteSequence,
  onAddRowInSequence,
  onMoveToPreviousSequence,
  onMoveToNextSequence,
  density = 'desktop',
  workAreaExpanded = false,
  bare = false,
  phoneImageSource = false,
  className,
}) => {
  const { t } = useAppTranslation();
  const ranges = getSequenceRowRanges(sequences);
  const voiceColumn = headers.findIndex((header) => isBriefVoHeader(header));
  const narrationForRow = (rowIndex: number) => {
    const anchor = narrationAnchorRow(bodyRows, voiceColumn, rowIndex);
    if (anchor < 0) return null;
    const cell = String(bodyRows[anchor]?.[voiceColumn] ?? '');
    const slides = savedVoSlides(voVersions, anchor, cell);
    if (slides.length === 0) return null;
    return {
      rowIndex: anchor,
      slides,
      activeIndex: activeVoSlide(voSlide[anchor], slides.length),
      onSelect: (index: number) => onSelectVoSlide?.(anchor, index),
    };
  };
  const canManageSequences = Boolean(showRowActions && onRenameSequence);
  const isMobile = density === 'mobile-2col';
  const scrollRef = useRef<HTMLDivElement>(null);
  const eagerCount =
    typeof window === 'undefined' ? 4 : Math.ceil(Math.max(360, window.innerWidth - 420) / 340) + 1;
  let eagerLeft = eagerCount;
  const hideAddSequence = useHideOnScrollDown(
    scrollRef,
    isMobile && canManageSequences,
    sequences.length,
  );

  return (
    <div
      className={cn(
        'relative flex h-full min-h-0 min-w-0 flex-1 flex-col',
        isMobile ? 'p-0' : 'p-2',
        className,
      )}
    >
      <div
        ref={scrollRef}
        className={cn(
          'flex h-full min-h-0 min-w-0 flex-1 flex-col justify-start gap-3 overflow-x-hidden overflow-y-auto pb-1',
          'scrollbar-hide seamless-scroll nested-scroll-touch-chain',
          '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          isMobile ? 'gap-4 pb-14' : '',
        )}
        style={{ overflowAnchor: 'none' } as React.CSSProperties}
      >
      {ranges.map(({ sequence, startRow, endRow }, sequenceIndex) => {
        const rows = bodyRows.slice(startRow, endRow);
        const shootLabels = shootHeaderLabels(
          rows.map((row, localIdx) =>
            shootNumberFromShotLabel(readShotBrief(headers, row).shot, localIdx + 1),
          ),
        );
        const canDelete = sequences.length > 1;

        return (
          <section
            key={sequence.id}
            className={cn(
              '@container/seq flex h-full min-h-0 w-full shrink-0 flex-col',
              !bare && (isMobile ? 'px-2 py-1' : 'py-1'),
            )}
          >
            <BriefSequenceHeader
              className="mb-2"
              name={sequence.name}
              canRename={canManageSequences}
              canDelete={Boolean(canDelete && onDeleteSequence)}
              onRename={(name) => onRenameSequence?.(sequence.id, name)}
              onDelete={() => onDeleteSequence?.(sequence.id)}
              onAddRow={
                canManageSequences && onAddRowInSequence
                  ? () => onAddRowInSequence(sequence.id)
                  : undefined
              }
            />
            <div
              className={cn(
                'flex min-h-0 w-full flex-1 flex-nowrap items-stretch gap-3 overflow-x-auto overflow-y-hidden pb-2',
                'scrollbar-hide [-webkit-overflow-scrolling:touch] [touch-action:pan-x_pan-y]',
                '[overscroll-behavior-x:contain] [overscroll-behavior-y:auto]',
                '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
              )}
              data-horizontal-scroll-zone
              data-scene-scroll
              data-vaul-no-drag
            >
              {rows.length === 0 ? (
                <p className="px-1 py-6 text-xs text-gray-500">
                  {t('briefDialog.layout.emptySequence', 'No scenes in this sequence yet.')}
                </p>
              ) : (
                rows.map((row, localIdx) => {
                  const rowIdx = startRow + localIdx;
                  const images = rowImagesMap[rowIdx] ?? [];
                  const isRowUploading = uploadingRowIndex === rowIdx;
                  const isRowDeleting = images.some((image) => image.id === deletingImageId);
                  const isFirstInSequence = localIdx === 0;
                  const isLastInSequence = localIdx === rows.length - 1;
                  const seqIndex = sequenceIndex;

                  const eager = eagerLeft > 0;
                  if (eager) eagerLeft -= 1;
                  const slotClassName = isMobile
                    ? 'min-h-[280px] w-[calc((100cqw-0.75rem)/1.25)] min-w-[calc((100cqw-0.75rem)/1.25)]'
                    : 'min-h-[420px] w-[360px]';

                  return (
                    <SceneSlot key={rowIdx} eager={eager} widthClassName={slotClassName}>
                    <BriefStoryBoardSceneCard
                      rowIndex={rowIdx}
                      sceneNumber={sequenceIndex + 1}
                      shootNumber={shootLabels[localIdx] ?? String(localIdx + 1)}
                      headers={headers}
                      row={row}
                      imageColumnIndex={imageColumnIndex}
                      images={images}
                      isEditing={isEditing}
                      showRowActions={showRowActions}
                      mediaBusy={mediaBusy}
                      isUploading={isRowUploading}
                      isDeleting={isRowDeleting}
                      planId={planId}
                      film={film}
                      density={density}
                      phoneImageSource={phoneImageSource}
                      characterIds={getSceneCharacterIds(sceneMeta, rowIdx)}
                      onCharacterIdsChange={onSceneCharacterIdsChange}
                      voVersions={voVersions}
                      voSlide={voSlide[rowIdx]}
                      onSelectVoSlide={(index) => onSelectVoSlide?.(rowIdx, index)}
                      narrationPlay={narrationForRow(rowIdx)}
                      fieldVersions={fieldVersions}
                      fieldSlide={fieldSlide}
                      fieldDrafts={fieldDrafts}
                      onSelectFieldSlide={(field, index) => onSelectFieldSlide?.(rowIdx, field, index)}
                      onFieldDraft={(field, index, text) => onFieldDraft?.(rowIdx, field, index, text)}
                      onCommitScene={(version) => onCommitScene?.(rowIdx, version)}
                      activeImageId={activeImageIds[rowIdx] ?? null}
                      onActiveImageIdChange={
                        onActiveImageIdChange
                          ? (imageId) => onActiveImageIdChange(rowIdx, imageId)
                          : undefined
                      }
                      masterPromptText={masterPromptByRow[rowIdx]}
                      onUpdateCell={onUpdateCell}
                      onUploadImages={onUploadImages}
                      onDeleteImage={onDeleteImage}
                      onAddRow={onAddRow}
                      onAddSequenceAfterRow={onAddSequenceAfterRow}
                      onDeleteRow={onDeleteRow}
                      canMoveToPreviousSequence={Boolean(
                        isFirstInSequence && seqIndex > 0 && onMoveToPreviousSequence,
                      )}
                      canMoveToNextSequence={Boolean(
                        isLastInSequence &&
                          seqIndex >= 0 &&
                          seqIndex < ranges.length - 1 &&
                          onMoveToNextSequence,
                      )}
                      onMoveToPreviousSequence={onMoveToPreviousSequence}
                      onMoveToNextSequence={onMoveToNextSequence}
                    />
                    </SceneSlot>
                  );
                })
              )}
              {canManageSequences && onAddRowInSequence ? (
                <button
                  type="button"
                  onClick={() => onAddRowInSequence(sequence.id)}
                  className={cn(
                    'flex shrink-0 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-300 bg-white text-xs text-gray-500 hover:border-blue-400 hover:text-blue-600',
                    isMobile
                      ? 'w-[calc((100cqw-0.75rem)/1.25)] min-w-[calc((100cqw-0.75rem)/1.25)] min-h-[160px]'
                      : 'w-[160px] min-h-[160px]',
                  )}
                >
                  <Plus className="h-4 w-4" />
                  {t('briefDialog.layout.addScene', 'Add scene')}
                </button>
              ) : null}
            </div>
          </section>
        );
      })}
      {!isMobile && canManageSequences ? (
        <div className="relative mt-1 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1 text-xs"
            onClick={onAddSequenceBelow}
          >
            <Plus className="h-3.5 w-3.5" />
            {t('briefDialog.layout.addSequenceBelow', 'Add Sequence below')}
          </Button>
        </div>
      ) : null}
      </div>

      {isMobile && canManageSequences ? (
        <div
          className={cn(
            'z-10 flex border-t border-border bg-background transition-[transform,opacity] duration-200 ease-out',
            isMobile
              ? cn(
                  'absolute inset-x-0 bottom-0 px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]',
                  hideAddSequence && 'pointer-events-none translate-y-full opacity-0',
                )
              : 'relative shrink-0 px-1 pb-1 pt-4',
          )}
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1 text-xs"
            onClick={onAddSequenceBelow}
          >
            <Plus className="h-3.5 w-3.5" />
            {t('briefDialog.layout.addSequenceBelow', 'Add Sequence below')}
          </Button>
        </div>
      ) : null}
    </div>
  );
};
