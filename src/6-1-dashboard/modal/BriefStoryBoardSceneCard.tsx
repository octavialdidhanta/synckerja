import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Loader2, MoreVertical, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { cn } from '@/shared/lib/utils';
import { toast } from 'sonner';
import { BriefStoryboardImageCell } from './BriefStoryboardImageCell';
import type { BriefStoryboardImageWithUrl } from '@/6-1-dashboard/hook/useBriefStoryboardImages';
import { generateBriefSceneImageFile } from '@/6-1-dashboard/lib/generateBriefSceneImage';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import {
  useDigitalAssetCharactersListQuery,
  useDigitalAssetCharacterPoseCountQuery,
} from '@/6-1-social-media-settings/hooks/useDigitalAssetsListQueries';

function AutoResizeTextarea({
  value,
  onChange,
  className,
  minRows = 2,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { minRows?: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(minRows * 24, el.scrollHeight)}px`;
  }, [value, minRows]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={onChange}
      className={className}
      rows={minRows}
      {...props}
    />
  );
}

function StoryBoardFieldValue({
  value,
  label,
  viewFullLabel,
}: {
  value: string;
  label: string;
  viewFullLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const trimmed = value.trim();

  if (!trimmed) {
    return <span className="min-w-0 flex-1 text-sm text-gray-400">—</span>;
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
          {value.replace(/\n/g, ' ')}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        className="max-w-[min(320px,90vw)] whitespace-pre-wrap break-words p-3 text-sm leading-relaxed"
        style={{ zIndex: 999999 }}
      >
        {value}
      </PopoverContent>
    </Popover>
  );
}



export interface BriefStoryBoardSceneCardProps {
  rowIndex: number;
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
  characterIds?: string[];
  onCharacterIdsChange?: (rowIndex: number, characterIds: string[]) => void;
  onUpdateCell: (rowIndex: number, cellIdx: number, value: string) => void;
  onUploadImages?: (rowIndex: number, files: File[]) => Promise<unknown>;
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
  characterIds = [],
  onCharacterIdsChange,
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
  const [addSelectKey, setAddSelectKey] = useState(0);
  const { data: characters = [] } = useDigitalAssetCharactersListQuery();
  const { data: poseCount = 0 } = useDigitalAssetCharacterPoseCountQuery(characterIds);

  const characterNamesById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of characters) {
      map[c.id] = c.name || c.id.slice(0, 8);
    }
    return map;
  }, [characters]);

  const selectedCharacters = useMemo(
    () =>
      characterIds
        .map((id) => characters.find((c) => c.id === id))
        .filter((c): c is NonNullable<typeof c> => Boolean(c)),
    [characterIds, characters],
  );

  const availableToAdd = useMemo(
    () => characters.filter((c) => !characterIds.includes(c.id)),
    [characters, characterIds],
  );

  const textColumns = headers
    .map((header, colIdx) => ({ header, colIdx }))
    .filter(({ colIdx }) => colIdx !== imageColumnIndex);

  const fallbackPoseCount =
    poseCount > 0 ? poseCount : characterIds.length > 0 ? characterIds.length : 0;

  const handleAddCharacter = (id: string) => {
    if (!id || characterIds.includes(id)) return;
    onCharacterIdsChange?.(rowIndex, [...characterIds, id]);
    setAddSelectKey((k) => k + 1);
  };

  const handleRemoveCharacter = (id: string) => {
    onCharacterIdsChange?.(
      rowIndex,
      characterIds.filter((cid) => cid !== id),
    );
  };

  const handleGenerate = async () => {
    if (!onUploadImages || !planId || isGenerating) return;
    setIsGenerating(true);
    try {
      const result = await generateBriefSceneImageFile({
        characterIds,
        characterNamesById,
        headers,
        row,
        imageColumnIndex,
        t,
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
      const msg =
        err instanceof Error
          ? err.message
          : t('briefDialog.layout.generateFailed', 'Image generation failed.');
      toast.error(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const hasSceneText = textColumns.some(({ colIdx }) =>
    String(row[colIdx] ?? '').trim(),
  );

  const canGenerate =
    Boolean(isEditing && planId && onUploadImages) &&
    hasSceneText &&
    !mediaBusy &&
    !isUploading &&
    !isDeleting &&
    !isGenerating;

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
          {t('briefDialog.layout.scene', 'Scene')} {rowIndex + 1}
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
          showUploadButton={Boolean(isEditing && planId)}
          uploadButtonLabel={t('briefDialog.layout.upload', 'Upload')}
        />

        {isEditing && planId && onUploadImages ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-full gap-1.5 border-gray-300 text-xs"
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
        ) : null}

        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-2 gap-y-1.5">
          {textColumns.map(({ header, colIdx }) => {
            const value = row[colIdx] ?? '';
            return (
              <React.Fragment key={colIdx}>
                <span className="whitespace-nowrap pt-0.5 text-[11px] font-semibold text-gray-500">
                  {header}:
                </span>
                {isEditing ? (
                  <AutoResizeTextarea
                    value={value}
                    minRows={1}
                    onChange={(e) => onUpdateCell(rowIndex, colIdx, e.target.value)}
                    className="min-w-0 w-full resize-none rounded border border-gray-200 bg-white px-1.5 py-0.5 text-sm text-gray-800 focus:border-blue-400 focus:outline-none"
                  />
                ) : (
                  <StoryBoardFieldValue
                    value={value}
                    label={header}
                    viewFullLabel={t('briefDialog.layout.viewFull', 'View full')}
                  />
                )}
              </React.Fragment>
            );
          })}

          <span className="whitespace-nowrap pt-0.5 text-[11px] font-semibold text-gray-500">
            {t('briefDialog.layout.character', 'Character')}:
          </span>
          <div className="min-w-0 space-y-1.5">
            {selectedCharacters.length === 0 ? (
              <span className="text-sm text-gray-400">—</span>
            ) : (
              <div className="flex min-w-0 flex-nowrap gap-1 overflow-x-auto overflow-y-hidden scrollbar-hide [touch-action:pan-x] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {selectedCharacters.map((c) => (
                  <span
                    key={c.id}
                    className="inline-flex shrink-0 items-center gap-0.5 rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-xs text-gray-800"
                  >
                    <span className="truncate">{c.name || c.id.slice(0, 8)}</span>
                    {isEditing && onCharacterIdsChange ? (
                      <button
                        type="button"
                        className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700"
                        onClick={() => handleRemoveCharacter(c.id)}
                        aria-label={t('briefDialog.layout.removeCharacter', 'Remove character')}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    ) : null}
                  </span>
                ))}
              </div>
            )}

            {isEditing && onCharacterIdsChange && availableToAdd.length > 0 ? (
              <Select key={addSelectKey} onValueChange={handleAddCharacter}>
                <SelectTrigger className="h-7 text-xs border-gray-300 bg-white">
                  <SelectValue
                    placeholder={t('briefDialog.layout.addCharacter', 'Add character…')}
                  />
                </SelectTrigger>
                <SelectContent style={{ zIndex: 999999 }}>
                  {availableToAdd.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      {c.name || c.id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}

            {density !== 'mobile-2col' && characterIds.length > 0 ? (
              <p className="text-[10px] text-blue-700">
                {t(
                  'briefDialog.layout.allPosesWillBeSent',
                  '{{count}} pose(s) will be sent for consistency.',
                  { count: fallbackPoseCount },
                )}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
};
