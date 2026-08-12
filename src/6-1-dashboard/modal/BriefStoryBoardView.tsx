import React from 'react';
import { Button } from '@/shared/components/ui/button';
import { Plus } from 'lucide-react';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { cn } from '@/shared/lib/utils';
import { BriefStoryBoardSceneCard } from './BriefStoryBoardSceneCard';
import { BriefSequenceHeader } from './BriefSequenceHeader';
import type { BriefStoryboardImageWithUrl } from '@/6-1-dashboard/hook/useBriefStoryboardImages';
import type { BriefSequence } from './briefSequences';
import { getSequenceRowRanges } from './briefSequences';
import type { BriefSceneMeta } from './briefSceneMeta';
import { getSceneCharacterIds } from './briefSceneMeta';

export interface BriefStoryBoardViewProps {
  headers: string[];
  bodyRows: string[][];
  imageColumnIndex: number;
  rowImagesMap: Record<number, BriefStoryboardImageWithUrl[]>;
  sequences: BriefSequence[];
  sceneMeta?: BriefSceneMeta[];
  isEditing: boolean;
  showRowActions: boolean;
  planId?: string;
  mediaBusy?: boolean;
  uploadingRowIndex?: number | null;
  deletingImageId?: string | null;
  onUpdateCell: (rowIndex: number, cellIdx: number, value: string) => void;
  onUploadImages?: (rowIndex: number, files: File[]) => Promise<unknown>;
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
  className?: string;
}

export const BriefStoryBoardView: React.FC<BriefStoryBoardViewProps> = ({
  headers,
  bodyRows,
  imageColumnIndex,
  rowImagesMap,
  sequences,
  sceneMeta = [],
  isEditing,
  showRowActions,
  planId,
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
  className,
}) => {
  const { t } = useAppTranslation();
  const ranges = getSequenceRowRanges(sequences);
  const canManageSequences = Boolean(showRowActions && onRenameSequence);

  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col gap-3 overflow-x-auto overflow-y-auto',
        density === 'mobile-2col' ? 'gap-2 p-0' : 'p-2',
        'scrollbar-hide seamless-scroll nested-scroll-touch-chain',
        '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
      style={{ overflowAnchor: 'none' } as React.CSSProperties}
    >
      {ranges.map(({ sequence, startRow, endRow }) => {
        const rows = bodyRows.slice(startRow, endRow);
        const canDelete = sequences.length > 1;

        return (
          <section
            key={sequence.id}
            className={cn(
              '@container/seq min-w-0 w-full shrink-0 border-dashed border-blue-200 bg-blue-50/20',
              density === 'mobile-2col'
                ? 'rounded-none border-x-0 border-y px-2 py-2'
                : 'rounded-lg border p-2',
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
            <div className="flex flex-row gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                  const seqIndex = ranges.findIndex((item) => item.sequence.id === sequence.id);

                  return (
                    <BriefStoryBoardSceneCard
                      key={rowIdx}
                      rowIndex={rowIdx}
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
                      density={density}
                      characterIds={getSceneCharacterIds(sceneMeta, rowIdx)}
                      onCharacterIdsChange={onSceneCharacterIdsChange}
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
                  );
                })
              )}
            </div>
          </section>
        );
      })}

      {canManageSequences ? (
        <div className="flex shrink-0">
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
