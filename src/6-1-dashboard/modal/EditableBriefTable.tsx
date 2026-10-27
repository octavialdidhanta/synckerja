import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Pencil, Check, X, MoreVertical, Trash2, Plus, Columns3, ArrowLeft, Copy } from 'lucide-react';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { cn } from '@/shared/lib/utils';
import { toast } from 'sonner';
import { BriefStoryboardImageCell } from './BriefStoryboardImageCell';
import { BriefMasterVideoButton, BriefVideoProvider } from './briefVideoContext';
import { BriefSeedanceVoiceButton, BriefVoiceOverActions, BriefVoiceProvider } from './briefVoiceContext';
import { BriefSceneGenerateButton } from './BriefSceneGenerateButton';
import { BriefImagePromptDialog } from './BriefImagePromptDialog';
import {
  adjustFieldVersionsForDeleteRow,
  adjustFieldVersionsForInsertRow,
  applyAuditedColumnEdits,
  briefAuditField,
  fieldVersionKey,
  focusFieldSlides,
  parseBriefFieldVersions,
  pairedSceneSlides,
  pairedSceneValue,
  pairedVeoIndex,
  shiftFieldDraftForDelete,
  shiftFieldDraftForInsert,
  shiftFieldSlideForDelete,
  shiftFieldSlideForInsert,
  type BriefFieldDraft,
  type BriefFieldVersions,
} from './briefFieldVersions';
import { BriefStoryBoardView, useHideOnScrollDown } from './BriefStoryBoardView';
import { BriefSequenceHeader } from './BriefSequenceHeader';
import {
  readBriefLayoutMode,
  writeBriefLayoutMode,
  type BriefLayoutMode,
} from './briefLayoutMode';
import {
  adjustSequencesForDeleteRow,
  adjustSequencesForInsertRow,
  createBriefSequence,
  findSequenceIndexForRow,
  getSequenceRowRanges,
  normalizeBriefSequences,
  parseBriefSequencesFromMarkdown,
  type BriefSequence,
} from './briefSequences';
import {
  adjustSceneMetaForDeleteRow,
  adjustSceneMetaForInsertRow,
  getSceneCharacterIds,
  parseBriefSceneMetaFromMarkdown,
  setSceneCharacterIds,
  type BriefSceneMeta,
} from './briefSceneMeta';
import {
  activeVoSlide,
  adjustVoVersionsForDeleteRow,
  adjustVoVersionsForInsertRow,
  focusLatestVoSlides,
  parseBriefVoVersions,
  rememberVoVersion,
  rememberVoVersions,
  savedVoSlides,
  shiftVoSlideForDelete,
  shiftVoSlideForInsert,
  type BriefVoVersions,
} from './briefVoVersions';
import { BriefVersionPager } from './BriefVersionPager';
import type { BriefStoryboardImageWithUrl, BriefImageSceneVersion } from '@/6-1-dashboard/hook/useBriefStoryboardImages';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/shared/components/ui/drawer';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip';
import { findBriefImageColumnIndex, isBriefVoHeader } from './briefStoryboardConstants';
import { activeShotBriefs, masterPromptWithActiveShots } from '@/6-1-dashboard/lib/seedanceVideo';
import { masterPromptRowSpans } from './masterPromptRows';
import { BriefMentionField, BriefMentionText } from './BriefMentionField';
import { storyboardShotAspect, type StoryboardFilmContext } from '@/6-1-dashboard/lib/generateBriefSceneImage';

/** Fixed storyboard column widths (px). */
const BRIEF_COLUMN_WIDTH_PX = {
  timing: 80,
  /** Middle columns (Visual, VO, Element Lainnya, …) — fixed when table scrolls horizontally. */
  content: 360,
  actions: 72,
  /** At most this many visible columns (data + actions) before horizontal scroll. */
  maxColumnsWithoutScroll: 6,
} as const;

function isTimingColumn(header: string, colIdx: number): boolean {
  if (colIdx === 0) return true;
  const h = String(header ?? '').trim().toLowerCase();
  return h === 'timing' || h === 'no' || h === '#' || h === 'no.';
}

/** Pad every row to the same column count (header-driven). */
function normalizeBriefTableRows(rows: string[][]): string[][] {
  if (rows.length === 0) return rows;
  const colCount = Math.max(...rows.map((r) => r.length), 1);
  return rows.map((row) => {
    const cells = [...row];
    while (cells.length < colCount) cells.push('');
    return cells.slice(0, colCount);
  });
}

/** Drop only trailing columns that are empty in header and all body rows. */
function trimTrailingEmptyColumns(rows: string[][]): string[][] {
  const normalized = normalizeBriefTableRows(rows);
  if (normalized.length === 0) return normalized;
  let colCount = normalized[0]?.length ?? 0;
  while (colCount > 1) {
    const colIdx = colCount - 1;
    const headerEmpty = (normalized[0]?.[colIdx] ?? '').trim() === '';
    const bodyEmpty = normalized.slice(1).every((row) => (row[colIdx] ?? '').trim() === '');
    if (!headerEmpty && !bodyEmpty) break;
    if (headerEmpty && bodyEmpty) {
      colCount -= 1;
      continue;
    }
    break;
  }
  return normalized.map((row) => row.slice(0, colCount));
}

function briefTableColumnKey(headerRow: string[]): string {
  return headerRow.map((h) => String(h ?? '').trim()).join('\x1f');
}

const briefTableCellClass =
  'border-b border-r border-gray-300 px-3 py-3 text-gray-700 align-top overflow-hidden break-words [overflow-wrap:anywhere] [word-break:break-word] min-w-0 last:border-r-0';

const briefTableHeaderClass =
  'sticky top-0 z-30 border-b-2 border-r border-gray-300 bg-gray-100 px-3 py-3 text-left font-semibold text-gray-900 min-w-0 overflow-hidden last:border-r-0 [box-shadow:0_-2px_0_0_theme(colors.gray.100)]';

interface EditableBriefTableProps {
  tableData: string[][];
  onSave?: (
    newTableData: string[][],
    meta?: {
      sequences: BriefSequence[];
      sceneMeta?: BriefSceneMeta[];
      voVersions?: BriefVoVersions[];
      fieldVersions?: BriefFieldVersions[];
    },
  ) => void;
  onChange?: (newTableData: string[][]) => void;
  /** When true, table is always editable (no Edit button), onChange called on every cell change */
  alwaysEditable?: boolean;
  /** When true, no edit/actions column (display-only, e.g. content calendar modal) */
  readOnly?: boolean;
  /** Where to render Edit/Save/Cancel controls when not alwaysEditable/readOnly */
  controlsPlacement?: 'actionsColumn' | 'taggingColumn';
  /** BriefDialog storyboard toolbar: Add column/row, Columns menu, Edit/Save/Cancel above table */
  storyboardToolbar?: boolean;
  /** Mobile calendar: ~2 content columns / scene cards visible with horizontal scroll */
  density?: 'desktop' | 'mobile-2col';
  /** Phone brief: Story Line keeps readable column widths and scrolls sideways, inset from the screen edge. */
  phoneFrame?: boolean;
  /** Brief markdown used to hydrate Story Board sequences (HTML comment metadata). */
  sequencesSource?: string;
  /** Notified when inline edit mode toggles (e.g. disable dialog footer actions) */
  onEditingChange?: (isEditing: boolean) => void;
  planId?: string;
  film?: StoryboardFilmContext;
  /** Brief dialog focus mode: the table fills the dialog without comments, header, or footer. */
  workAreaExpanded?: boolean;
  onToggleWorkArea?: () => void;
  imageColumnIndex?: number;
  rowImagesMap?: Record<number, BriefStoryboardImageWithUrl[]>;
  onUploadImages?: (rowIndex: number, files: File[], promptOverride?: string | BriefImageSceneVersion | null) => Promise<unknown>;
  onDeleteImage?: (imageId: string) => Promise<unknown>;
  onInsertRowImages?: (insertAtRowIndex: number) => Promise<unknown>;
  onDeleteRowImages?: (rowIndex: number) => Promise<unknown>;
  mediaBusy?: boolean;
  uploadingRowIndex?: number | null;
  deletingImageId?: string | null;
  className?: string;
}

function StoryLineVisualCell({
  rowIndex,
  headers,
  row,
  imageColumnIndex,
  images,
  editable,
  disabled,
  isUploading,
  isDeleting,
  planId,
  film,
  characterIds,
  mediaBusy,
  onUploadImages,
  onDeleteImage,
  activeImageId,
  onActiveImageIdChange,
  onEditPrompt,
  phoneImageSource = false,
}: {
  rowIndex: number;
  headers: string[];
  row: string[];
  imageColumnIndex: number;
  images: BriefStoryboardImageWithUrl[];
  editable: boolean;
  disabled: boolean;
  isUploading: boolean;
  isDeleting: boolean;
  planId?: string;
  film?: StoryboardFilmContext;
  characterIds: string[];
  mediaBusy: boolean;
  onUploadImages?: (rowIndex: number, files: File[], promptOverride?: string | BriefImageSceneVersion | null) => Promise<unknown>;
  onDeleteImage?: (imageId: string) => Promise<unknown>;
  activeImageId?: string | null;
  onActiveImageIdChange?: (imageId: string) => void;
  onEditPrompt?: () => void;
  phoneImageSource?: boolean;
}) {
  const [isGenerating, setIsGenerating] = useState(false);

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <BriefStoryboardImageCell
        rowIndex={rowIndex}
        images={images}
        editable={editable}
        disabled={disabled || isGenerating}
        isUploading={isUploading || isGenerating}
        isDeleting={isDeleting}
        onUploadFiles={onUploadImages}
        onDeleteImage={onDeleteImage}
        activeImageId={activeImageId}
        onActiveImageIdChange={onActiveImageIdChange}
        onEditPrompt={onEditPrompt}
        frame={film ? storyboardShotAspect(film) : undefined}
        phoneImageSource={phoneImageSource}
      />
      {images.length === 0 ? (
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
      ) : null}
    </div>
  );
}

export const EditableBriefTable: React.FC<EditableBriefTableProps> = ({
  tableData,
  onSave,
  onChange,
  alwaysEditable = false,
  readOnly = false,
  controlsPlacement = 'actionsColumn',
  storyboardToolbar = false,
  density = 'desktop',
  phoneFrame = false,
  sequencesSource,
  onEditingChange,
  planId,
  film,
  workAreaExpanded = false,
  onToggleWorkArea,
  imageColumnIndex: imageColumnIndexProp,
  rowImagesMap = {},
  onUploadImages,
  onDeleteImage,
  onInsertRowImages,
  onDeleteRowImages,
  mediaBusy = false,
  uploadingRowIndex = null,
  deletingImageId = null,
  className = '',
}) => {
  const uploadImages = readOnly ? undefined : onUploadImages;
  const deleteImage = readOnly ? undefined : onDeleteImage;
  const { t } = useAppTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<string[][]>([]);
  const [layoutMode, setLayoutMode] = useState<BriefLayoutMode>(() => readBriefLayoutMode());
  const [editingColumnIndex, setEditingColumnIndex] = useState<number | null>(null);
  const [columnsDrawerOpen, setColumnsDrawerOpen] = useState(false);
  const [columnNameDraft, setColumnNameDraft] = useState('');
  const [sequences, setSequences] = useState<BriefSequence[]>(() =>
    normalizeBriefSequences(
      parseBriefSequencesFromMarkdown(sequencesSource ?? ''),
      Math.max(0, (tableData?.length ?? 1) - 1),
      t('briefDialog.layout.defaultSequence', 'Sequence 1'),
    ),
  );
  const [sceneMeta, setSceneMeta] = useState<BriefSceneMeta[]>(() =>
    parseBriefSceneMetaFromMarkdown(sequencesSource ?? ''),
  );
  const [voVersions, setVoVersions] = useState<BriefVoVersions[]>(() =>
    parseBriefVoVersions(sequencesSource ?? ''),
  );
  const [voSlide, setVoSlide] = useState<Record<number, number>>({});
  const [fieldVersions, setFieldVersions] = useState<BriefFieldVersions[]>(() =>
    parseBriefFieldVersions(sequencesSource ?? ''),
  );
  const [fieldSlide, setFieldSlide] = useState<Record<string, number>>({});
  const [fieldDrafts, setFieldDrafts] = useState<Record<string, BriefFieldDraft>>({});
  const [copiedMasterPromptRow, setCopiedMasterPromptRow] = useState<number | null>(null);
  const [activeImageIds, setActiveImageIds] = useState<Record<number, string>>({});
  const [imagePromptRow, setImagePromptRow] = useState<number | null>(null);
  const selectImage = (rowIndex: number, imageId: string) => {
    setActiveImageIds((current) => (current[rowIndex] === imageId ? current : { ...current, [rowIndex]: imageId }));
  };
  const copiedMasterPromptTimer = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (copiedMasterPromptTimer.current) window.clearTimeout(copiedMasterPromptTimer.current);
    };
  }, []);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sequencesRef = useRef(sequences);
  sequencesRef.current = sequences;
  const sceneMetaRef = useRef(sceneMeta);
  sceneMetaRef.current = sceneMeta;
  const voVersionsRef = useRef(voVersions);
  voVersionsRef.current = voVersions;
  const fieldVersionsRef = useRef(fieldVersions);
  fieldVersionsRef.current = fieldVersions;
  const fieldDraftsRef = useRef(fieldDrafts);
  fieldDraftsRef.current = fieldDrafts;
  /** Avoid clobbering a just-saved sequence split when parent briefText hydrates one tick later. */
  const skipNextSequencesHydrationRef = useRef(false);

  const handleLayoutModeChange = (mode: BriefLayoutMode) => {
    if (isEditing || mode === layoutMode) return;
    setLayoutMode(mode);
    writeBriefLayoutMode(mode);
  };

  useEffect(() => {
    onEditingChange?.(isEditing);
  }, [isEditing, onEditingChange]);

  useEffect(() => {
    return () => {
      onEditingChange?.(false);
    };
  }, [onEditingChange]);

  const normalizedTableData = normalizeBriefTableRows(tableData);
  const displayData = trimTrailingEmptyColumns(normalizedTableData);
  /**
   * Prefer Visual-by-name so Timing|VO|Visual tables do not treat VO as the paste slot.
   * Without planId (e.g. AI script manual edit), skip image column so all cells stay text.
   */
  const imageColumnIndex = !planId
    ? -1
    : typeof imageColumnIndexProp === 'number'
      ? imageColumnIndexProp
      : findBriefImageColumnIndex(displayData[0] ?? []);
  const bodyRowCount = Math.max(0, displayData.length - 1);
  const defaultSequenceName = t('briefDialog.layout.defaultSequence', 'Sequence 1');

  useEffect(() => {
    if (!storyboardToolbar || isEditing) return;
    if (skipNextSequencesHydrationRef.current) {
      skipNextSequencesHydrationRef.current = false;
      return;
    }
    setSequences(
      normalizeBriefSequences(
        parseBriefSequencesFromMarkdown(sequencesSource ?? ''),
        bodyRowCount,
        defaultSequenceName,
      ),
    );
    setSceneMeta(parseBriefSceneMetaFromMarkdown(sequencesSource ?? ''));
    setVoVersions(parseBriefVoVersions(sequencesSource ?? ''));
    setFieldVersions(parseBriefFieldVersions(sequencesSource ?? ''));
  }, [storyboardToolbar, sequencesSource, bodyRowCount, isEditing, defaultSequenceName]);

  const colCount = Math.max(...displayData.map((r) => r.length), 1);
  const padRow = (row: string[]) => {
    const r = [...row];
    while (r.length < colCount) r.push('');
    return r;
  };

  const padTable = (rows: string[][], targetColCount: number): string[][] => {
    return rows.map((row) => {
      const a = [...row];
      while (a.length < targetColCount) a.push('');
      return a.slice(0, targetColCount);
    });
  };

  const sanitizeStoryboardData = (rows: string[][]): string[][] => {
    return rows.map((row, rowIdx) => row.map((cell, colIdx) => {
      if (rowIdx > 0 && colIdx === imageColumnIndex) return '';
      return cell;
    }));
  };

  const persistTable = (
    newData: string[][],
    nextSequences?: BriefSequence[],
    nextSceneMeta?: BriefSceneMeta[],
    nextVoVersions?: BriefVoVersions[],
    nextFieldVersions?: BriefFieldVersions[],
  ) => {
    if (readOnly) return newData;
    const finalColCount = Math.max(...newData.map((r) => r.length), 1);
    const padded = sanitizeStoryboardData(padTable(newData, finalColCount));
    const nextBodyCount = Math.max(0, padded.length - 1);
    const normalizedSequences = normalizeBriefSequences(
      nextSequences ?? sequencesRef.current,
      nextBodyCount,
      defaultSequenceName,
    );
    const meta = nextSceneMeta ?? sceneMetaRef.current;
    const versions = nextVoVersions ?? voVersionsRef.current;
    const fields = nextFieldVersions ?? fieldVersionsRef.current;
    setSequences(normalizedSequences);
    setSceneMeta(meta);
    setVoVersions(versions);
    setFieldVersions(fields);
    onSave?.(padded, { sequences: normalizedSequences, sceneMeta: meta, voVersions: versions, fieldVersions: fields });
    return padded;
  };

  const startEdit = () => {
    if (readOnly) return;
    const bodyRows = displayData.slice(1).map(padRow);
    setEditData(bodyRows);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditData([]);
    setFieldDrafts({});
  };

  const saveEdit = () => {
    const scrollTop = scrollContainerRef.current?.scrollTop ?? 0;
    const tableColCount = Math.max(...tableData.map((r) => r.length), 1);
    const headerRow = tableData[0] ?? [];
    const newData = [headerRow, ...editData.map((row) => {
      const a = [...row];
      while (a.length < tableColCount) a.push('');
      return a.slice(0, tableColCount);
    })];
    const recorded = rememberVoVersions(
      voVersionsRef.current,
      tableData[0] ?? [],
      tableData.slice(1),
      editData,
    );
    const audited = storyboardToolbar
      ? applyAuditedColumnEdits({
          history: fieldVersionsRef.current,
          headers: headerRow,
          previousBody: tableData.slice(1),
          nextBody: newData.slice(1),
          drafts: fieldDraftsRef.current,
        })
      : { history: fieldVersionsRef.current, body: newData.slice(1), focus: [] };
    setVoSlide((current) => focusLatestVoSlides(current, recorded.history, recorded.changedRows));
    setFieldSlide((current) => focusFieldSlides(current, audited.focus));
    setFieldDrafts({});
    persistTable([headerRow, ...audited.body], undefined, undefined, recorded.history, audited.history);
    setIsEditing(false);
    setEditData([]);
    setTimeout(() => {
      scrollContainerRef.current?.scrollTo({ top: scrollTop });
    }, 0);
  };

  const handleDeleteRow = async (rowIdx: number) => {
    if (readOnly) return;
    const tableColCount = Math.max(...tableData.map((r) => r.length), 1);
    const headerRow = (tableData[0] ?? displayData[0] ?? []).slice(0, tableColCount);
    const body = isEditing ? editData : displayData.slice(1);
    await onDeleteRowImages?.(rowIdx);
    const newBody = body.filter((_, i) => i !== rowIdx).map((row) => {
      const a = [...row];
      while (a.length < tableColCount) a.push('');
      return a.slice(0, tableColCount);
    });
    const nextSequences = adjustSequencesForDeleteRow(sequencesRef.current, rowIdx);
    const nextSceneMeta = adjustSceneMetaForDeleteRow(sceneMetaRef.current, rowIdx);
    const nextVoVersions = adjustVoVersionsForDeleteRow(voVersionsRef.current, rowIdx);
    const nextFieldVersions = adjustFieldVersionsForDeleteRow(fieldVersionsRef.current, rowIdx);
    setVoSlide((current) => shiftVoSlideForDelete(current, rowIdx));
    setFieldSlide((current) => shiftFieldSlideForDelete(current, rowIdx));
    setFieldDrafts((current) => shiftFieldDraftForDelete(current, rowIdx));
    persistTable([headerRow, ...newBody], nextSequences, nextSceneMeta, nextVoVersions, nextFieldVersions);
    if (isEditing) {
      setEditData(newBody);
    }
  };

  const handleAddRow = async (rowIdx: number, sequenceId?: string) => {
    if (readOnly) return;
    const tableColCount = Math.max(...tableData.map((r) => r.length), 1);
    const headerRow = (tableData[0] ?? displayData[0] ?? []).slice(0, tableColCount);
    const body = isEditing ? editData : displayData.slice(1);
    const emptyRow = Array.from({ length: tableColCount }, () => '');
    if (tableColCount > imageColumnIndex) {
      emptyRow[imageColumnIndex] = '';
    }
    const insertAt = rowIdx + 1;
    await onInsertRowImages?.(insertAt);
    const newBody = [...body.slice(0, insertAt), emptyRow, ...body.slice(insertAt)].map((row) => {
      const a = [...row];
      while (a.length < tableColCount) a.push('');
      return a.slice(0, tableColCount);
    });
    const nextSequences = sequenceId
      ? sequencesRef.current.map((seq) =>
          seq.id === sequenceId ? { ...seq, rowCount: seq.rowCount + 1 } : { ...seq },
        )
      : adjustSequencesForInsertRow(sequencesRef.current, rowIdx);
    const nextSceneMeta = adjustSceneMetaForInsertRow(sceneMetaRef.current, insertAt);
    const nextVoVersions = adjustVoVersionsForInsertRow(voVersionsRef.current, insertAt);
    const nextFieldVersions = adjustFieldVersionsForInsertRow(fieldVersionsRef.current, insertAt);
    setVoSlide((current) => shiftVoSlideForInsert(current, insertAt));
    setFieldSlide((current) => shiftFieldSlideForInsert(current, insertAt));
    setFieldDrafts((current) => shiftFieldDraftForInsert(current, insertAt));
    persistTable([headerRow, ...newBody], nextSequences, nextSceneMeta, nextVoVersions, nextFieldVersions);
    if (isEditing) {
      setEditData(newBody);
    }
  };

  const handleAppendRow = async () => {
    const body = isEditing ? editData : displayData.slice(1);
    if (body.length === 0) {
      await handleAddRow(-1);
      return;
    }
    await handleAddRow(body.length - 1);
  };

  const handleAddColumn = () => {
    const tableColCount = Math.max(...tableData.map((r) => r.length), 1);
    const newHeader = `Column ${tableColCount + 1}`;
    const newData = tableData.map((row, i) => {
      const a = [...row];
      while (a.length < tableColCount) a.push('');
      a.push(i === 0 ? newHeader : '');
      return a;
    });
    persistTable(newData);
    if (isEditing) {
      setEditData((prev) => prev.map((row) => [...row, '']));
    }
  };

  const handleRenameColumn = (colIdx: number, name: string) => {
    const nextName = name.trim();
    const source = normalizeBriefTableRows(
      isEditing ? [displayData[0] ?? [], ...editData] : displayData,
    );
    const currentHeader = (source[0]?.[colIdx] ?? '').trim();
    if (!nextName || nextName === currentHeader) return;
    const tableColCount = Math.max(...source.map((r) => r.length), 1);
    const newData = source.map((row, rowIdx) => {
      const a = [...row];
      while (a.length < tableColCount) a.push('');
      if (rowIdx === 0) a[colIdx] = nextName;
      return a.slice(0, tableColCount);
    });
    persistTable(newData);
  };

  const handleRemoveColumn = (colIdx: number) => {
    if (colIdx === imageColumnIndex) {
      toast.error(t('briefDialog.storyboard.columnRequired', 'This column is required'));
      return;
    }
    const source = normalizeBriefTableRows(isEditing ? [displayData[0] ?? [], ...editData] : displayData);
    const currentColCount = Math.max(...source.map((r) => r.length), 1);
    if (currentColCount <= 1) return;
    const newData = source.map((row) => row.filter((_, i) => i !== colIdx));
    persistTable(newData);
    if (isEditing) {
      setEditData(newData.slice(1));
    }
    toast.success(t('briefDialog.storyboard.columnRemoved', 'Column removed'));
  };

  const updateCell = (rowIdx: number, cellIdx: number, value: string) => {
    if (cellIdx === imageColumnIndex) return;
    const headerName = String((tableData[0] ?? displayData[0] ?? [])[cellIdx] ?? '');
    if (headerName.trim().toLowerCase() === 'master prompt') return;
    if (storyboardToolbar && briefAuditField(headerName)) return;
    const tableColCount = Math.max(...(tableData.length ? tableData : displayData).map((r) => r.length), 1);
    if (alwaysEditable && onChange) {
      const newData = tableData.map((r, i) => {
        if (i !== rowIdx + 1) return [...r];
        const newRow = [...r];
        while (newRow.length <= cellIdx) newRow.push('');
        newRow[cellIdx] = value;
        const a = [...newRow];
        while (a.length < tableColCount) a.push('');
        return a.slice(0, tableColCount);
      });
      onChange(newData);
      return;
    }
    if (!isEditing) {
      const headerRow = (tableData[0] ?? displayData[0] ?? []).slice(0, tableColCount);
      const body = displayData.slice(1).map((row) => {
        const next = [...row];
        while (next.length < tableColCount) next.push('');
        return next.slice(0, tableColCount);
      });
      while (body.length <= rowIdx) body.push(Array.from({ length: tableColCount }, () => ''));
      const row = [...(body[rowIdx] ?? [])];
      while (row.length <= cellIdx) row.push('');
      row[cellIdx] = value;
      body[rowIdx] = row.slice(0, tableColCount);
      const versions = isBriefVoHeader(headerName)
        ? rememberVoVersion(
            voVersionsRef.current,
            rowIdx,
            String((displayData[rowIdx + 1] ?? [])[cellIdx] ?? ''),
            value,
          )
        : voVersionsRef.current;
      if (versions !== voVersionsRef.current) {
        setVoSlide((current) => focusLatestVoSlides(current, versions, [rowIdx]));
      }
      persistTable([headerRow, ...body], undefined, undefined, versions);
      return;
    }
    setEditData((prev) => {
      const next = prev.map((r) => [...r]);
      const row = next[rowIdx];
      if (!row || cellIdx < 0) return prev;
      const newRow = [...row];
      while (newRow.length <= cellIdx) newRow.push('');
      newRow[cellIdx] = value;
      next[rowIdx] = newRow;
      return next;
    });
  };

  const commitScene = (rowIdx: number, version: { shot: string; angle: string; visualFunction: string; veoPrompt: string }) => {
    if (readOnly) return;
    const headers = tableData[0] ?? displayData[0] ?? [];
    const tableColCount = Math.max(...(tableData.length ? tableData : displayData).map((row) => row.length), 1);
    const values: Record<string, string> = {
      shot: version.shot.trim(),
      angle: version.angle.trim(),
      visual: version.visualFunction.trim(),
      veo: version.veoPrompt.trim(),
    };
    const savedHeader = headers.slice(0, tableColCount);
    const body = displayData.slice(1).map((row) => {
      const next = [...row];
      while (next.length < tableColCount) next.push('');
      return next.slice(0, tableColCount);
    });
    while (body.length <= rowIdx) body.push(Array.from({ length: tableColCount }, () => ''));
    const row = [...(body[rowIdx] ?? [])];
    let changed = false;
    headers.forEach((header, col) => {
      const field = briefAuditField(String(header ?? ''));
      if (!field || values[field] == null) return;
      while (row.length <= col) row.push('');
      if (row[col] !== values[field]) changed = true;
      row[col] = values[field];
    });
    if (!changed) return;
    body[rowIdx] = row.slice(0, tableColCount);
    persistTable([savedHeader, ...body]);
    if (isEditing) {
      setEditData((prev) => {
        const next = prev.map((item) => [...item]);
        const editRow = [...(next[rowIdx] ?? [])];
        headers.forEach((header, col) => {
          const field = briefAuditField(String(header ?? ''));
          if (!field || values[field] == null) return;
          while (editRow.length <= col) editRow.push('');
          editRow[col] = values[field];
        });
        next[rowIdx] = editRow;
        return next;
      });
    }
  };

  if (displayData.length === 0) return null;

  const headerRow = padRow(displayData[0]);
  const bodyRowsSource = alwaysEditable ? tableData.slice(1) : (isEditing ? editData : displayData.slice(1));
  const bodyRows = bodyRowsSource.map(padRow);
  const taggingHeaderIndex = (() => {
    const idx = headerRow.findIndex((h) => String(h ?? '').trim().toLowerCase() === 'tagging');
    return idx >= 0 ? idx : Math.max(0, headerRow.length - 1);
  })();

  const showHeaderControls =
    !storyboardToolbar && !alwaysEditable && !readOnly;
  const showRowActionsColumn = !alwaysEditable && !readOnly;

  const renderHeaderControls = () => {
    if (!showHeaderControls) return null;
    if (isEditing) {
      return (
        <div className="flex gap-1 justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={saveEdit}
            disabled={mediaBusy}
            className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
            title={t('common.save', 'Save')}
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={cancelEdit}
            disabled={mediaBusy}
            className="h-8 w-8 p-0 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            title={t('common.cancel', 'Cancel')}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      );
    }
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={startEdit}
        disabled={mediaBusy}
        className="h-8 w-8 p-0 text-gray-500 hover:text-blue-600 hover:bg-blue-50"
        title={t('common.edit', 'Edit')}
      >
        <Pencil className="h-4 w-4" />
      </Button>
    );
  };

  const contentColumnCount = Math.max(headerRow.length - 1, 0);
  const totalVisibleColumns = headerRow.length + (showRowActionsColumn ? 1 : 0);
  const isMobile2Col = density === 'mobile-2col';
  const phoneToolbar = isMobile2Col || phoneFrame;
  const useHorizontalScrollLayout =
    isMobile2Col || phoneFrame || totalVisibleColumns > BRIEF_COLUMN_WIDTH_PX.maxColumnsWithoutScroll;
  const storyLineColWidth = (header: string, index: number) =>
    isTimingColumn(header, index) ? BRIEF_COLUMN_WIDTH_PX.timing : BRIEF_COLUMN_WIDTH_PX.content;
  const fixedSidesPx =
    BRIEF_COLUMN_WIDTH_PX.timing + (showRowActionsColumn ? BRIEF_COLUMN_WIDTH_PX.actions : 0);
  const sharedContentWidth =
    contentColumnCount > 0
      ? `calc((100% - ${fixedSidesPx}px) / ${contentColumnCount})`
      : undefined;
  /** ~2 content columns fit in the scroll viewport; remaining columns scroll horizontally. */
  const mobileContentColCss = 'calc((100cqw - 0.5rem) / 2)';
  const scrollTableWidthPx = isMobile2Col
    ? undefined
    : BRIEF_COLUMN_WIDTH_PX.timing +
      contentColumnCount * BRIEF_COLUMN_WIDTH_PX.content +
      (showRowActionsColumn ? BRIEF_COLUMN_WIDTH_PX.actions : 0);
  const scrollTableWidthCss = isMobile2Col
    ? `calc(${BRIEF_COLUMN_WIDTH_PX.timing}px + ${contentColumnCount} * ((100cqw - 0.5rem) / 2)${
        showRowActionsColumn ? ` + ${BRIEF_COLUMN_WIDTH_PX.actions}px` : ''
      })`
    : undefined;
  const tableLayoutKey = briefTableColumnKey(headerRow);

  const renderStoryboardToolbar = () => {
    if (!storyboardToolbar || alwaysEditable || !onSave) return null;

    const toolbarBtnClass = cn(
      'h-8 shrink-0 text-xs',
      phoneToolbar && 'whitespace-nowrap [touch-action:pan-x]',
    );

    const layoutToggle = (
      <div
        className="flex shrink-0 items-center rounded-md border border-gray-200 bg-gray-50 p-0.5 [touch-action:pan-x]"
        role="group"
        aria-label={t('briefDialog.layout.toggleLabel', 'Layout mode')}
      >
        {([
          ['storyline', t('briefDialog.layout.storyLine', 'Story Line')],
          ['storyboard', t('briefDialog.layout.storyBoard', 'Story Board')],
        ] as const).map(([mode, label]) => (
          <Button
            key={mode}
            type="button"
            variant={layoutMode === mode ? 'default' : 'ghost'}
            size="sm"
            disabled={isEditing}
            className={cn(
              'h-7 px-2.5 text-xs',
              layoutMode === mode
                ? 'shadow-sm'
                : 'text-gray-600 hover:bg-white hover:text-gray-900',
            )}
            onClick={() => handleLayoutModeChange(mode)}
          >
            {label}
          </Button>
        ))}
      </div>
    );

    const editActions = isEditing ? (
      <>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={saveEdit}
          disabled={mediaBusy}
          className={cn(
            toolbarBtnClass,
            'gap-1 text-green-600 hover:bg-green-50 hover:text-green-700',
          )}
        >
          <Check className="h-4 w-4" />
          {t('common.save', 'Save')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={cancelEdit}
          disabled={mediaBusy}
          className={cn(toolbarBtnClass, 'gap-1 text-gray-600 hover:bg-gray-100')}
        >
          <X className="h-4 w-4" />
          {t('common.cancel', 'Cancel')}
        </Button>
      </>
    ) : (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={startEdit}
        disabled={mediaBusy}
        className={cn(toolbarBtnClass, 'gap-1')}
      >
        <Pencil className="h-3.5 w-3.5" />
        {t('briefDialog.edit', 'Edit')}
      </Button>
    );

    const workAreaButton = onToggleWorkArea && workAreaExpanded ? (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn(toolbarBtnClass, 'gap-1')}
        onClick={onToggleWorkArea}
        title={t('briefDialog.workArea.back', 'Back')}
        aria-label={t('briefDialog.workArea.back', 'Back')}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {t('briefDialog.workArea.back', 'Back')}
      </Button>
    ) : null;

    return (
      <div
        className={cn(
          'mb-2 flex shrink-0 items-center gap-2',
          phoneToolbar
            ? 'mb-0 min-w-0'
            : 'flex-wrap justify-between',
          isMobile2Col && 'border-y border-border bg-background',
        )}
      >
        <div
          data-vaul-no-drag={phoneToolbar ? '' : undefined}
          style={phoneToolbar ? { touchAction: 'pan-x' } : undefined}
          className={cn(
            'flex items-center gap-1',
            phoneToolbar
              ? 'w-full min-w-0 flex-nowrap overflow-x-auto overflow-y-hidden py-1.5 scrollbar-hide [touch-action:pan-x] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
              : 'flex-wrap',
            isMobile2Col && 'pl-3 pr-4',
          )}
        >
          {isEditing ? (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex shrink-0">{layoutToggle}</span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-xs">
                  {t(
                    'briefDialog.layout.switchBlocked',
                    'Save or cancel editing before switching layout',
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            layoutToggle
          )}
          {readOnly ? null : (
          <>
          <Button type="button" variant="outline" size="sm" className={toolbarBtnClass} onClick={handleAddColumn}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            {t('briefDialog.storyboard.addColumn', 'Add column')}
          </Button>
          {layoutMode === 'storyline' ? (
            <Button type="button" variant="outline" size="sm" className={toolbarBtnClass} onClick={() => void handleAppendRow()}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              {t('briefDialog.addRow', 'Add row')}
            </Button>
          ) : null}
          {(() => {
            const manageColumnsList = (
              <div className="space-y-1.5 py-1">
                {headerRow.map((header, colIdx) => {
                  const label =
                    header ||
                    t('briefDialog.storyboard.columnPlaceholder', 'Column {{n}}', { n: colIdx + 1 });
                  const canDelete = colIdx !== imageColumnIndex && headerRow.length > 1;
                  const isColumnEditing = editingColumnIndex === colIdx;

                  return (
                    <div
                      key={colIdx}
                      className="flex items-center gap-1 rounded-md border border-gray-200 bg-white px-1.5 py-1"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {isColumnEditing ? (
                        <input
                          type="text"
                          value={columnNameDraft}
                          autoFocus
                          onChange={(e) => setColumnNameDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleRenameColumn(colIdx, columnNameDraft);
                              setEditingColumnIndex(null);
                              setColumnNameDraft('');
                            }
                            if (e.key === 'Escape') {
                              e.preventDefault();
                              setEditingColumnIndex(null);
                              setColumnNameDraft('');
                            }
                            e.stopPropagation();
                          }}
                          className="h-7 min-w-0 flex-1 rounded border border-blue-300 bg-white px-1.5 text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-400"
                          aria-label={t('briefDialog.storyboard.renameColumn', 'Rename column')}
                        />
                      ) : (
                        <span className="min-w-0 flex-1 truncate px-1.5 text-xs text-gray-800">{label}</span>
                      )}
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 shrink-0 p-0 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                            title={t('common.actions', 'Actions')}
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          {isColumnEditing ? (
                            <>
                              <DropdownMenuItem
                                className="gap-2 text-green-700 focus:text-green-700"
                                onClick={() => {
                                  handleRenameColumn(colIdx, columnNameDraft);
                                  setEditingColumnIndex(null);
                                  setColumnNameDraft('');
                                }}
                              >
                                <Check className="h-4 w-4" />
                                {t('common.save', 'Save')}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="gap-2"
                                onClick={() => {
                                  setEditingColumnIndex(null);
                                  setColumnNameDraft('');
                                }}
                              >
                                <X className="h-4 w-4" />
                                {t('common.cancel', 'Cancel')}
                              </DropdownMenuItem>
                            </>
                          ) : (
                            <DropdownMenuItem
                              className="gap-2"
                              onClick={() => {
                                setEditingColumnIndex(colIdx);
                                setColumnNameDraft(label);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                              {t('briefDialog.edit', 'Edit')}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            disabled={!canDelete}
                            className="gap-2 text-red-600 focus:text-red-600"
                            onClick={() => {
                              if (!canDelete) return;
                              handleRemoveColumn(colIdx);
                              if (editingColumnIndex === colIdx) {
                                setEditingColumnIndex(null);
                                setColumnNameDraft('');
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                            {t('briefDialog.storyboard.removeColumn', 'Remove column')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  );
                })}
              </div>
            );

            const resetColumnEditor = () => {
              setEditingColumnIndex(null);
              setColumnNameDraft('');
            };

            if (isMobile2Col) {
              return (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={toolbarBtnClass}
                    onClick={() => setColumnsDrawerOpen(true)}
                  >
                    <Columns3 className="mr-1 h-3.5 w-3.5" />
                    {t('briefDialog.storyboard.columns', 'Columns')}
                  </Button>
                  <Drawer
                    shouldScaleBackground={false}
                    open={columnsDrawerOpen}
                    onOpenChange={(open) => {
                      setColumnsDrawerOpen(open);
                      if (!open) resetColumnEditor();
                    }}
                  >
                    <DrawerContent
                      className="z-50 max-h-[85vh] px-0 pb-4"
                      overlayClassName="z-50"
                    >
                      <DrawerHeader className="px-4 pb-2 text-left">
                        <DrawerTitle className="text-base">
                          {t('briefDialog.storyboard.manageColumns', 'Manage columns')}
                        </DrawerTitle>
                      </DrawerHeader>
                      <div className="max-h-[min(60vh,420px)] overflow-y-auto px-3 pb-2">
                        {manageColumnsList}
                      </div>
                    </DrawerContent>
                  </Drawer>
                </>
              );
            }

            return (
              <DropdownMenu
                onOpenChange={(open) => {
                  if (!open) resetColumnEditor();
                }}
              >
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className={toolbarBtnClass}>
                    <Columns3 className="mr-1 h-3.5 w-3.5" />
                    {t('briefDialog.storyboard.columns', 'Columns')}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-72 p-2" onCloseAutoFocus={(e) => e.preventDefault()}>
                  <DropdownMenuLabel className="px-1 text-xs font-normal text-muted-foreground">
                    {t('briefDialog.storyboard.manageColumns', 'Manage columns')}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {manageColumnsList}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          })()}
          </>
          )}
          {phoneToolbar ? (
            <>
              {readOnly ? null : editActions}
              {workAreaButton}
            </>
          ) : null}
        </div>
        {phoneToolbar ? null : (
          <div className="flex items-center gap-1">
            {readOnly ? null : editActions}
            {workAreaButton}
          </div>
        )}
      </div>
    );
  };

  const useStoryBoardLayout = storyboardToolbar && layoutMode === 'storyboard';
  const normalizedSequences = normalizeBriefSequences(
    sequences,
    bodyRows.length,
    defaultSequenceName,
  );
  const sequenceRanges = getSequenceRowRanges(normalizedSequences);
  const canManageSequences = Boolean(storyboardToolbar && showRowActionsColumn && onSave);
  const hideAddSequence = useHideOnScrollDown(
    scrollContainerRef,
    isMobile2Col && canManageSequences && !useStoryBoardLayout,
    normalizedSequences.length,
  );
  const tableColSpan = headerRow.length + (showRowActionsColumn ? 1 : 0);
  const masterPromptColumnIndex = headerRow.findIndex(
    (header) => header.trim().toLowerCase() === 'master prompt',
  );
  const voiceColumnIndex = headerRow.findIndex((header) => {
    const name = header.trim().toLowerCase();
    return name === 'vo' || name.includes('voice') || name.includes('narasi');
  });
  const masterPromptSpans = masterPromptRowSpans({
    rows: bodyRows,
    masterColumn: masterPromptColumnIndex,
    voiceColumn: voiceColumnIndex,
    ranges: storyboardToolbar
      ? sequenceRanges.map(({ startRow, endRow }) => ({ startRow, endRow }))
      : [{ startRow: 0, endRow: bodyRows.length }],
  });
  const masterPromptSpanByRow = new Map(masterPromptSpans.map((item) => [item.row, item.span]));
  const masterPromptSkipRows = new Set<number>();
  for (const item of masterPromptSpans) {
    for (let offset = 1; offset < item.span; offset += 1) masterPromptSkipRows.add(item.row + offset);
  }
  const shownMasterByRow: Record<number, string> = {};
  if (masterPromptColumnIndex >= 0) {
    bodyRows.forEach((row, rowIdx) => {
      if (masterPromptSkipRows.has(rowIdx)) return;
      const raw = String(row[masterPromptColumnIndex] ?? '');
      if (!raw.trim()) return;
      const span = masterPromptSpanByRow.get(rowIdx) ?? 1;
      const indexes = Array.from({ length: span }, (_, offset) => rowIdx + offset);
      shownMasterByRow[rowIdx] = masterPromptWithActiveShots(
        raw,
        activeShotBriefs(headerRow, bodyRows, rowImagesMap, activeImageIds, indexes),
      );
    });
  }
  const copyMasterPrompt = async (rowIdx: number, value: string) => {
    if (!value.trim()) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      return;
    }
    setCopiedMasterPromptRow(rowIdx);
    if (copiedMasterPromptTimer.current) window.clearTimeout(copiedMasterPromptTimer.current);
    copiedMasterPromptTimer.current = window.setTimeout(() => setCopiedMasterPromptRow(null), 1600);
  };

  const getCurrentTableForPersist = (): string[][] => {
    const tableColCount = Math.max(...tableData.map((r) => r.length), 1);
    const header = (tableData[0] ?? displayData[0] ?? []).slice(0, tableColCount);
    const body = (isEditing ? editData : displayData.slice(1)).map((row) => {
      const a = [...row];
      while (a.length < tableColCount) a.push('');
      return a.slice(0, tableColCount);
    });
    return [header, ...body];
  };

  const persistSequencesOnly = (nextSequences: BriefSequence[]) => {
    if (readOnly) return;
    const bodyCount = isEditing ? Math.max(editData.length, bodyRowCount) : bodyRowCount;
    const normalized = normalizeBriefSequences(
      nextSequences,
      bodyCount,
      defaultSequenceName,
    );
    sequencesRef.current = normalized;
    setSequences(normalized);
    if (!isEditing) {
      skipNextSequencesHydrationRef.current = true;
    }
    onSave?.(getCurrentTableForPersist(), {
      sequences: normalized,
      sceneMeta: sceneMetaRef.current,
    });
  };

  const handleSceneCharacterIdsChange = (rowIndex: number, characterIds: string[]) => {
    if (readOnly) return;
    const nextMeta = setSceneCharacterIds(sceneMetaRef.current, rowIndex, characterIds);
    setSceneMeta(nextMeta);
    const bodyCount = isEditing ? Math.max(editData.length, bodyRowCount) : bodyRowCount;
    onSave?.(getCurrentTableForPersist(), {
      sequences: normalizeBriefSequences(
        sequencesRef.current,
        bodyCount,
        defaultSequenceName,
      ),
      sceneMeta: nextMeta,
    });
  };

  const nextSequenceLabel = (sequenceCount: number) =>
    t('briefDialog.layout.newSequenceNumber', 'Sequence {{n}}', { n: sequenceCount });

  const handleRenameSequence = (sequenceId: string, name: string) => {
    persistSequencesOnly(
      sequencesRef.current.map((seq) => (seq.id === sequenceId ? { ...seq, name } : seq)),
    );
  };

  const handleAddSequenceBelow = () => {
    persistSequencesOnly([
      ...sequencesRef.current,
      createBriefSequence(nextSequenceLabel(sequencesRef.current.length + 1), 0),
    ]);
  };

  const handleAddSequenceAfterRow = async (rowIndex: number) => {
    const current = sequencesRef.current.map((sequence) => ({ ...sequence }));
    const sequenceIndex = findSequenceIndexForRow(current, rowIndex);
    const ranges = getSequenceRowRanges(current);
    const range = ranges[sequenceIndex];
    if (!range) return;

    const keepCount = rowIndex - range.startRow + 1;
    const moveCount = Math.max(0, current[sequenceIndex].rowCount - keepCount);
    current[sequenceIndex] = {
      ...current[sequenceIndex],
      rowCount: keepCount,
    };

    const label = nextSequenceLabel(current.length + 1);

    if (moveCount > 0) {
      current.splice(sequenceIndex + 1, 0, createBriefSequence(label, moveCount));
      persistSequencesOnly(current);
      return;
    }

    // Selected row is last in its sequence: create a new sequence and add one blank scene into it.
    current.splice(sequenceIndex + 1, 0, createBriefSequence(label, 0));
    const bodyCount = isEditing ? Math.max(editData.length, bodyRowCount) : bodyRowCount;
    sequencesRef.current = normalizeBriefSequences(current, bodyCount, defaultSequenceName);
    setSequences(sequencesRef.current);
    if (!isEditing) {
      skipNextSequencesHydrationRef.current = true;
    }
    await handleAddRow(rowIndex);
  };

  const handleDeleteSequence = (sequenceId: string) => {
    const current = sequencesRef.current;
    if (current.length <= 1) return;
    const idx = current.findIndex((seq) => seq.id === sequenceId);
    if (idx < 0) return;
    const target = current[idx];
    const next = current.filter((_, i) => i !== idx).map((seq) => ({ ...seq }));
    if (target.rowCount > 0) {
      const mergeIdx = idx > 0 ? idx - 1 : 0;
      next[mergeIdx] = {
        ...next[mergeIdx],
        rowCount: next[mergeIdx].rowCount + target.rowCount,
      };
    }
    persistSequencesOnly(next);
  };

  const handleAddRowInSequence = async (sequenceId: string) => {
    const ranges = getSequenceRowRanges(sequencesRef.current);
    const range = ranges.find((item) => item.sequence.id === sequenceId);
    if (!range) return;
    const insertAfter = range.rowCount === 0 ? range.startRow - 1 : range.endRow - 1;
    await handleAddRow(insertAfter, sequenceId);
  };

  const handleMoveToNextSequence = (rowIndex: number) => {
    const current = sequencesRef.current.map((seq) => ({ ...seq }));
    const ranges = getSequenceRowRanges(current);
    const seqIdx = ranges.findIndex(
      (item) => rowIndex >= item.startRow && rowIndex < item.endRow,
    );
    if (seqIdx < 0 || seqIdx >= current.length - 1) return;
    if (rowIndex !== ranges[seqIdx].endRow - 1) return;
    if (current[seqIdx].rowCount <= 0) return;
    current[seqIdx] = { ...current[seqIdx], rowCount: current[seqIdx].rowCount - 1 };
    current[seqIdx + 1] = { ...current[seqIdx + 1], rowCount: current[seqIdx + 1].rowCount + 1 };
    persistSequencesOnly(current);
  };

  const handleMoveToPreviousSequence = (rowIndex: number) => {
    const current = sequencesRef.current.map((seq) => ({ ...seq }));
    const ranges = getSequenceRowRanges(current);
    const seqIdx = ranges.findIndex(
      (item) => rowIndex >= item.startRow && rowIndex < item.endRow,
    );
    if (seqIdx <= 0) return;
    if (rowIndex !== ranges[seqIdx].startRow) return;
    if (current[seqIdx].rowCount <= 0) return;
    current[seqIdx] = { ...current[seqIdx], rowCount: current[seqIdx].rowCount - 1 };
    current[seqIdx - 1] = { ...current[seqIdx - 1], rowCount: current[seqIdx - 1].rowCount + 1 };
    persistSequencesOnly(current);
  };

  const renderStoryLineBodyRow = (
    rowIdx: number,
    sequenceMeta?: {
      isFirstInSequence: boolean;
      isLastInSequence: boolean;
      seqIndex: number;
    },
  ) => {
    const row = bodyRows[rowIdx];
    if (!row) return null;
    const displayRow = padRow(row);
    const rowImages = rowImagesMap[rowIdx] ?? [];
    const isRowUploading = uploadingRowIndex === rowIdx;
    const isRowDeleting = rowImages.some((image) => image.id === deletingImageId);
    const isStructureBusy = mediaBusy && uploadingRowIndex === null && deletingImageId === null;
    const canMovePrev = Boolean(
      sequenceMeta?.isFirstInSequence &&
        (sequenceMeta.seqIndex ?? 0) > 0 &&
        storyboardToolbar,
    );
    const canMoveNext = Boolean(
      sequenceMeta?.isLastInSequence &&
        sequenceMeta.seqIndex >= 0 &&
        sequenceMeta.seqIndex < sequenceRanges.length - 1 &&
        storyboardToolbar,
    );

    return (
      <tr key={rowIdx} className="hover:bg-gray-50/80 transition-colors">
        {displayRow.map((cell, cellIdx) => {
          if (cellIdx === masterPromptColumnIndex && masterPromptSkipRows.has(rowIdx)) return null;
          const isMasterPrompt = cellIdx === masterPromptColumnIndex;
          const masterSpan = isMasterPrompt ? masterPromptSpanByRow.get(rowIdx) : undefined;
          const masterText = isMasterPrompt ? (shownMasterByRow[rowIdx] ?? cell).trim() : '';
          const voiceHeader = isBriefVoHeader(String(headerRow[cellIdx] ?? ''));
          const voiceSlides = voiceHeader ? savedVoSlides(voVersions, rowIdx, cell) : [];
          const voiceActive = activeVoSlide(voSlide[rowIdx], voiceSlides.length);
          const voiceEditingLatest = (isEditing || alwaysEditable) && voiceActive >= voiceSlides.length - 1;
          const voiceText = voiceSlides.length > 1 && !voiceEditingLatest ? (voiceSlides[voiceActive] ?? cell) : cell;
          const auditField = storyboardToolbar ? briefAuditField(String(headerRow[cellIdx] ?? '')) : null;
          const auditView = auditField
            ? (() => {
                const slides = pairedSceneSlides(cell, rowImages, auditField);
                const active = pairedVeoIndex(rowImages, activeImageIds[rowIdx]);
                return { slides, active, text: slides[active] ?? cell };
              })()
            : null;
          return (
            <td
              key={cellIdx}
              rowSpan={masterSpan}
              className={cn(
                briefTableCellClass,
                phoneFrame && '[touch-action:pan-x_pan-y]',
                isMasterPrompt && 'overflow-visible',
              )}
              style={
                phoneFrame
                  ? {
                      width: storyLineColWidth(String(headerRow[cellIdx] ?? ''), cellIdx),
                      minWidth: storyLineColWidth(String(headerRow[cellIdx] ?? ''), cellIdx),
                      touchAction: 'pan-x pan-y',
                    }
                  : undefined
              }
            >
              {cellIdx === imageColumnIndex ? (
                <StoryLineVisualCell
                  rowIndex={rowIdx}
                  headers={headerRow}
                  row={displayRow}
                  imageColumnIndex={imageColumnIndex}
                  images={rowImages}
                  editable={Boolean((isEditing || alwaysEditable) && planId && !readOnly)}
                  disabled={!planId || isStructureBusy || isRowUploading || isRowDeleting}
                  isUploading={isRowUploading}
                  isDeleting={isRowDeleting}
                  planId={planId}
                  film={film}
                  characterIds={getSceneCharacterIds(sceneMeta, rowIdx)}
                  mediaBusy={isStructureBusy}
                  onUploadImages={uploadImages}
                  onDeleteImage={deleteImage}
                  activeImageId={activeImageIds[rowIdx] ?? null}
                  onActiveImageIdChange={(imageId) => selectImage(rowIdx, imageId)}
                  onEditPrompt={
                    planId && film && uploadImages ? () => setImagePromptRow(rowIdx) : undefined
                  }
                  phoneImageSource={phoneFrame}
                />
              ) : auditView && auditField ? (
                <div className="min-w-0">
                  <BriefMentionText
                    value={auditView.text}
                    concept={film?.concept}
                    className="block min-w-0 w-full whitespace-pre-wrap"
                  />
                  <BriefVersionPager
                    count={auditView.slides.length}
                    activeIndex={auditView.active}
                    onSelect={(index) => {
                      const image = rowImages[index];
                      if (image) selectImage(rowIdx, image.id);
                    }}
                  />
                </div>
              ) : (
                <div className="min-w-0">
                  {masterText ? (
                    <div className="mb-1 flex justify-end">
                      <BriefMasterVideoButton rowIndex={rowIdx} className="h-7 w-7 shrink-0 bg-white p-0" />
                      <BriefSeedanceVoiceButton rowIndex={rowIdx} scope="master" />
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 shrink-0 bg-white p-0"
                        aria-label={
                          copiedMasterPromptRow === rowIdx
                            ? t('briefDialog.masterPromptCopied', 'Copied')
                            : t('briefDialog.copyMasterPrompt', 'Copy master prompt')
                        }
                        title={
                          copiedMasterPromptRow === rowIdx
                            ? t('briefDialog.masterPromptCopied', 'Copied')
                            : t('briefDialog.copyMasterPrompt', 'Copy master prompt')
                        }
                        onClick={() => void copyMasterPrompt(rowIdx, shownMasterByRow[rowIdx] ?? cell)}
                      >
                        {copiedMasterPromptRow === rowIdx ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                        ) : (
                          <Copy className="h-3.5 w-3.5" aria-hidden />
                        )}
                      </Button>
                    </div>
                  ) : null}
                  {isMasterPrompt ? (
                    <div
                      aria-disabled="true"
                      className="box-border min-h-[60px] w-full cursor-default select-text rounded border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm text-gray-600"
                    >
                      <BriefMentionText
                        value={shownMasterByRow[rowIdx] ?? cell}
                        concept={film?.concept}
                        className="block min-w-0 w-full whitespace-pre-wrap"
                      />
                    </div>
                  ) : voiceSlides.length > 1 ? (
                    <div className="min-w-0">
                      {voiceEditingLatest ? (
                        <BriefMentionField
                          value={cell}
                          concept={film?.concept}
                          onChange={(next) => updateCell(rowIdx, cellIdx, next)}
                          className="box-border w-full min-w-0 max-w-full min-h-[60px] flex-1 rounded border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 [overflow-wrap:anywhere] [word-break:break-word]"
                          minRows={2}
                        />
                      ) : (
                        <BriefMentionText
                          value={voiceText}
                          concept={film?.concept}
                          className="block min-w-0 w-full whitespace-pre-wrap"
                        />
                      )}
                      <BriefVersionPager
                        count={voiceSlides.length}
                        activeIndex={voiceActive}
                        onSelect={(index) => setVoSlide((current) => ({ ...current, [rowIdx]: index }))}
                      />
                    </div>
                  ) : (isEditing || alwaysEditable) ? (
                    <BriefMentionField
                      value={cell}
                      concept={film?.concept}
                      onChange={(next) => updateCell(rowIdx, cellIdx, next)}
                      className="box-border w-full min-w-0 max-w-full min-h-[60px] flex-1 rounded border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 [overflow-wrap:anywhere] [word-break:break-word]"
                      minRows={2}
                    />
                  ) : (
                    <BriefMentionText
                      value={cell}
                      concept={film?.concept}
                      className="block min-w-0 w-full whitespace-pre-wrap"
                    />
                  )}
                  {voiceHeader ? (
                    <BriefVoiceOverActions
                      rowIndex={rowIdx}
                      text={voiceText}
                      onChangeText={(next) => updateCell(rowIdx, cellIdx, next)}
                    />
                  ) : null}
                </div>
              )}
            </td>
          );
        })}
        {showRowActionsColumn && (
          <td
            className={cn(
              briefTableCellClass,
              'overflow-hidden whitespace-nowrap border-l border-gray-300 px-2 align-middle',
              phoneFrame && '[touch-action:pan-x_pan-y]',
            )}
            style={
              phoneFrame
                ? { width: BRIEF_COLUMN_WIDTH_PX.actions, minWidth: BRIEF_COLUMN_WIDTH_PX.actions, touchAction: 'pan-x pan-y' }
                : undefined
            }
          >
            {onSave && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={mediaBusy}
                    className="h-8 w-8 p-0 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                    title={t('common.actions', 'Actions')}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => void handleAddRow(rowIdx)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    {t('briefDialog.addRow', 'Add row')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleAddSequenceAfterRow(rowIdx)}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    {t('briefDialog.layout.addSequence', 'Add sequence')}
                  </DropdownMenuItem>
                  {canMovePrev ? (
                    <DropdownMenuItem
                      onClick={() => handleMoveToPreviousSequence(rowIdx)}
                      className="gap-2"
                    >
                      {t('briefDialog.layout.moveToPreviousSequence', 'Move to previous sequence')}
                    </DropdownMenuItem>
                  ) : null}
                  {canMoveNext ? (
                    <DropdownMenuItem
                      onClick={() => handleMoveToNextSequence(rowIdx)}
                      className="gap-2"
                    >
                      {t('briefDialog.layout.moveToNextSequence', 'Move to next sequence')}
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem
                    onClick={() => void handleDeleteRow(rowIdx)}
                    className="gap-2 text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                    {t('briefDialog.deleteRow', 'Delete row')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </td>
        )}
      </tr>
    );
  };

  const addSequenceBelowButton = canManageSequences ? (
    <div
      className={cn(
        'z-10 flex bg-background transition-[transform,opacity] duration-200 ease-out',
        isMobile2Col
          ? cn(
              'absolute inset-x-0 bottom-0 border-t border-border px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]',
              hideAddSequence && 'pointer-events-none translate-y-full opacity-0',
            )
          : 'relative mx-2 mb-2 mt-2 shrink-0',
      )}
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 gap-1 text-xs"
        onClick={handleAddSequenceBelow}
      >
        <Plus className="h-3.5 w-3.5" />
        {t('briefDialog.layout.addSequenceBelow', 'Add Sequence below')}
      </Button>
    </div>
  ) : null;

  return (
    <BriefVideoProvider
      planId={planId}
      headers={headerRow}
      rows={bodyRows}
      film={film}
      imagesByRow={rowImagesMap}
      masterSpans={masterPromptSpans}
      activeImageIds={activeImageIds}
      onActiveImageChange={selectImage}
      canGenerate={!readOnly}
    >
      <BriefVoiceProvider planId={planId} canGenerate={!readOnly && Boolean(planId)}>
    <div
      className={cn(
        'relative flex min-h-0 flex-col overflow-hidden',
        storyboardToolbar && 'h-full min-h-0 flex-1',
        className,
      )}
    >
      {renderStoryboardToolbar()}
      <div
        ref={scrollContainerRef}
        data-vaul-no-drag={phoneFrame && !useStoryBoardLayout ? '' : undefined}
        className={cn(
          'min-h-0 scrollbar-hide seamless-scroll [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          storyboardToolbar || workAreaExpanded || useStoryBoardLayout ? 'min-h-0 flex-1' : 'flex-none',
          isMobile2Col
            ? cn(
                '@container/brief my-0 w-full min-w-0 rounded-none border-x-0 border-y border-border',
                'nested-scroll-touch-chain-xy [-webkit-overflow-scrolling:touch]',
                useStoryBoardLayout
                  ? 'flex min-h-0 flex-col overflow-hidden [overscroll-behavior-y:contain]'
                  : 'overflow-x-auto overflow-y-auto pb-14 [overscroll-behavior:contain]',
              )
            : phoneFrame && useStoryBoardLayout
              ? 'flex min-h-0 min-w-0 w-full max-h-full flex-1 flex-col overflow-hidden'
            : phoneFrame && !useStoryBoardLayout
              ? 'nested-scroll-touch-chain-xy min-h-0 min-w-0 w-full max-h-full flex-1 overflow-x-auto overflow-y-auto overscroll-x-contain rounded-lg border border-gray-300 [-webkit-overflow-scrolling:touch] [touch-action:pan-x_pan-y]'
            : cn(
                'overflow-x-auto overflow-y-auto nested-scroll-touch-chain rounded-lg border-2 border-gray-300',
                useStoryBoardLayout && 'mt-1',
                workAreaExpanded ? 'mb-0' : 'mb-2',
                storyboardToolbar
                  ? 'max-h-full min-h-0 flex-1'
                  : 'max-h-[min(720px,78vh)]',
              ),
          useStoryBoardLayout && !isMobile2Col && 'flex min-h-0 flex-col overflow-hidden',
        )}
        style={{
          overflowAnchor: 'none',
          WebkitOverflowScrolling: 'touch',
          ...(phoneFrame && !useStoryBoardLayout ? { touchAction: 'pan-x pan-y' as const } : {}),
        }}
      >
        {useStoryBoardLayout ? (
          <BriefStoryBoardView
            headers={headerRow}
            bodyRows={bodyRows}
            imageColumnIndex={imageColumnIndex}
            rowImagesMap={rowImagesMap}
            sequences={normalizedSequences}
            sceneMeta={sceneMeta}
            voVersions={voVersions}
            voSlide={voSlide}
            onSelectVoSlide={(rowIndex, index) => setVoSlide((current) => ({ ...current, [rowIndex]: index }))}
            fieldVersions={fieldVersions}
            fieldSlide={fieldSlide}
            fieldDrafts={fieldDrafts}
            onSelectFieldSlide={(rowIndex, field, index) => setFieldSlide((current) => ({
              ...current,
              [fieldVersionKey(rowIndex, field)]: index,
            }))}
            onFieldDraft={(rowIndex, field, index, text) => setFieldDrafts((current) => ({
              ...current,
              [fieldVersionKey(rowIndex, field)]: { index, text },
            }))}
            onCommitScene={commitScene}
            activeImageIds={activeImageIds}
            onActiveImageIdChange={selectImage}
            masterPromptByRow={shownMasterByRow}
            isEditing={isEditing || alwaysEditable}
            showRowActions={Boolean(showRowActionsColumn && onSave)}
            planId={planId}
            film={film}
            density={density}
            bare={phoneFrame}
            phoneImageSource={phoneFrame}
            className={phoneFrame ? 'p-0' : undefined}
            mediaBusy={mediaBusy}
            uploadingRowIndex={uploadingRowIndex}
            deletingImageId={deletingImageId}
            onUpdateCell={updateCell}
            onUploadImages={uploadImages}
            onDeleteImage={deleteImage}
            onAddRow={(rowIdx) => void handleAddRow(rowIdx)}
            onAddSequenceAfterRow={handleAddSequenceAfterRow}
            onDeleteRow={(rowIdx) => void handleDeleteRow(rowIdx)}
            onSceneCharacterIdsChange={handleSceneCharacterIdsChange}
            onRenameSequence={handleRenameSequence}
            onAddSequenceBelow={handleAddSequenceBelow}
            onDeleteSequence={handleDeleteSequence}
            onAddRowInSequence={(sequenceId) => void handleAddRowInSequence(sequenceId)}
            onMoveToPreviousSequence={handleMoveToPreviousSequence}
            onMoveToNextSequence={handleMoveToNextSequence}
            workAreaExpanded={workAreaExpanded}
          />
        ) : (
          <div
            className={cn(
              !phoneFrame && storyboardToolbar && 'flex flex-col',
              useHorizontalScrollLayout && !phoneFrame && 'w-max min-w-full',
            )}
            style={
              phoneFrame && scrollTableWidthPx
                ? { width: scrollTableWidthPx, minWidth: scrollTableWidthPx }
                : undefined
            }
          >
            <table
              key={tableLayoutKey}
              className={cn(
                'table-fixed border-separate border-spacing-0 text-sm',
                phoneFrame && '[touch-action:pan-x_pan-y]',
                !useHorizontalScrollLayout && 'w-full',
              )}
              style={
                useHorizontalScrollLayout
                  ? isMobile2Col
                    ? { width: scrollTableWidthCss, minWidth: scrollTableWidthCss }
                    : { width: scrollTableWidthPx, minWidth: scrollTableWidthPx }
                  : undefined
              }
            >
              <colgroup>
                {headerRow.map((header, j) => (
                  <col
                    key={j}
                    style={
                      isTimingColumn(header, j)
                        ? {
                            width: BRIEF_COLUMN_WIDTH_PX.timing,
                            minWidth: phoneFrame ? BRIEF_COLUMN_WIDTH_PX.timing : undefined,
                          }
                        : useHorizontalScrollLayout
                          ? isMobile2Col
                            ? { width: mobileContentColCss, minWidth: mobileContentColCss }
                            : {
                                width: BRIEF_COLUMN_WIDTH_PX.content,
                                minWidth: phoneFrame ? BRIEF_COLUMN_WIDTH_PX.content : undefined,
                              }
                          : { width: sharedContentWidth }
                    }
                  />
                ))}
                {showRowActionsColumn ? <col style={{ width: BRIEF_COLUMN_WIDTH_PX.actions }} /> : null}
              </colgroup>
              <thead className="sticky top-0 z-30 bg-gray-100">
                <tr>
                  {headerRow.map((cell, j) => {
                    const shouldRenderControlsInThisHeader =
                      showHeaderControls &&
                      controlsPlacement === 'taggingColumn' &&
                      j === taggingHeaderIndex;

                    return (
                      <th
                        key={j}
                        className={cn(
                          briefTableHeaderClass,
                          phoneFrame && '[touch-action:pan-x_pan-y]',
                        )}
                        style={
                          phoneFrame
                            ? {
                                width: storyLineColWidth(cell, j),
                                minWidth: storyLineColWidth(cell, j),
                                touchAction: 'pan-x pan-y',
                              }
                            : undefined
                        }
                      >
                        {shouldRenderControlsInThisHeader ? (
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate">{cell}</span>
                            {renderHeaderControls()}
                        </div>
                        ) : (
                          <span className="block truncate" title={cell}>
                            {cell}
                          </span>
                        )}
                      </th>
                    );
                  })}
                  {showRowActionsColumn && (
                    <th
                      className={cn(
                        briefTableHeaderClass,
                        'overflow-hidden whitespace-nowrap border-l border-gray-300 px-2',
                        phoneFrame && '[touch-action:pan-x_pan-y]',
                      )}
                      style={
                        phoneFrame
                          ? { width: BRIEF_COLUMN_WIDTH_PX.actions, minWidth: BRIEF_COLUMN_WIDTH_PX.actions, touchAction: 'pan-x pan-y' }
                          : undefined
                      }
                    >
                      {showHeaderControls && controlsPlacement === 'actionsColumn'
                        ? renderHeaderControls()
                        : null}
                    </th>
                  )}
                </tr>
              </thead>
              {storyboardToolbar ? (
                sequenceRanges.map(({ sequence, startRow, endRow }, seqIndex) => {
                  const rowIndexes = Array.from(
                    { length: Math.max(0, endRow - startRow) },
                    (_, i) => startRow + i,
                  );
                  return (
                    <tbody key={sequence.id} className="bg-white">
                      <tr>
                        <td
                          colSpan={tableColSpan}
                          className="border-b border-gray-300 p-0"
                          style={phoneFrame ? { touchAction: 'pan-x pan-y' } : undefined}
                        >
                          <BriefSequenceHeader
                            className="rounded-none border-x-0 border-t-0 border-b border-blue-100"
                            name={sequence.name}
                            canRename={canManageSequences}
                            canDelete={Boolean(canManageSequences && normalizedSequences.length > 1)}
                            onRename={(name) => handleRenameSequence(sequence.id, name)}
                            onDelete={() => handleDeleteSequence(sequence.id)}
                            onAddRow={
                              canManageSequences
                                ? () => void handleAddRowInSequence(sequence.id)
                                : undefined
                            }
                          />
                        </td>
                      </tr>
                      {rowIndexes.length === 0 ? (
                        <tr>
                          <td
                            colSpan={tableColSpan}
                            className="border-b border-gray-200 px-3 py-4 text-xs text-gray-500"
                          >
                            {t(
                              'briefDialog.layout.emptySequence',
                              'No scenes in this sequence yet.',
                            )}
                          </td>
                        </tr>
                      ) : (
                        rowIndexes.map((rowIdx, localIdx) =>
                          renderStoryLineBodyRow(rowIdx, {
                            isFirstInSequence: localIdx === 0,
                            isLastInSequence: localIdx === rowIndexes.length - 1,
                            seqIndex,
                          }),
                        )
                      )}
                    </tbody>
                  );
                })
              ) : (
                <tbody className="bg-white">
                  {bodyRows.map((_, rowIdx) => renderStoryLineBodyRow(rowIdx))}
                </tbody>
              )}
            </table>
            {!isMobile2Col ? addSequenceBelowButton : null}
          </div>
        )}
      </div>
      {isMobile2Col && !useStoryBoardLayout ? addSequenceBelowButton : null}
    </div>
    <BriefImagePromptDialog
      open={imagePromptRow != null && Boolean(uploadImages)}
      rowIndex={imagePromptRow ?? 0}
      headers={headerRow}
      row={imagePromptRow != null ? (bodyRows[imagePromptRow] ?? []) : []}
      imageColumnIndex={imageColumnIndex}
      film={film}
      planId={planId}
      characterIds={imagePromptRow != null ? getSceneCharacterIds(sceneMeta, imagePromptRow) : []}
      startingShot={imagePromptRow == null ? null : pairedSceneValue(
        String((bodyRows[imagePromptRow] ?? [])[headerRow.findIndex((header) => briefAuditField(String(header ?? '')) === 'shot')] ?? ''),
        rowImagesMap[imagePromptRow] ?? [],
        'shot',
        activeImageIds[imagePromptRow],
      )}
      startingAngle={imagePromptRow == null ? null : pairedSceneValue(
        String((bodyRows[imagePromptRow] ?? [])[headerRow.findIndex((header) => briefAuditField(String(header ?? '')) === 'angle')] ?? ''),
        rowImagesMap[imagePromptRow] ?? [],
        'angle',
        activeImageIds[imagePromptRow],
      )}
      startingVisual={imagePromptRow == null ? null : pairedSceneValue(
        String((bodyRows[imagePromptRow] ?? [])[headerRow.findIndex((header) => briefAuditField(String(header ?? '')) === 'visual')] ?? ''),
        rowImagesMap[imagePromptRow] ?? [],
        'visual',
        activeImageIds[imagePromptRow],
      )}
      startingPrompt={imagePromptRow == null ? null : pairedSceneValue(
        String((bodyRows[imagePromptRow] ?? [])[headerRow.findIndex((header) => briefAuditField(String(header ?? '')) === 'veo')] ?? ''),
        rowImagesMap[imagePromptRow] ?? [],
        'veo',
        activeImageIds[imagePromptRow],
      )}
      onUploadImages={uploadImages}
      onClose={() => setImagePromptRow(null)}
      onCreated={(imageId, version) => {
        if (imagePromptRow == null) return;
        if (imageId) selectImage(imagePromptRow, imageId);
        commitScene(imagePromptRow, version);
      }}
    />
          </BriefVoiceProvider>
        </BriefVideoProvider>
  );
};
