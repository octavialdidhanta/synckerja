import React, { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  parseMarkdownTable,
  replaceTableInMarkdown,
  stringifyMarkdownTable,
} from '@/6-1-dashboard/utils/markdownTableUtils';
import { EditableBriefTable } from '@/6-1-dashboard/modal/EditableBriefTable';
import { BriefStoryboardEmptyState } from '@/6-1-dashboard/modal/BriefStoryboardEmptyState';
import { CreateBriefTableDialog } from '@/6-1-dashboard/modal/CreateBriefTableDialog';
import {
  DEFAULT_BRIEF_STORYBOARD_HEADERS,
  isBriefStoryboardTableCanonical,
  normalizeBriefStoryboardTable,
} from '@/6-1-dashboard/modal/briefStoryboardConstants';
import {
  stripBreakdownScriptLabel,
  removeBriefTitleFromStart,
  makeBriefSectionsInline,
} from '@/shared/utils/briefUtils';
import {
  upsertBriefSequencesInMarkdown,
  stripBriefSequencesComment,
  type BriefSequence,
} from '@/6-1-dashboard/modal/briefSequences';
import {
  upsertBriefSceneMetaInMarkdown,
  stripBriefSceneMetaComment,
  type BriefSceneMeta,
} from '@/6-1-dashboard/modal/briefSceneMeta';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useSocialMediaMutations } from '@/6-1-dashboard/hook/useOptimizedSocialMediaState';
import { useBriefStoryboardImages } from '@/6-1-dashboard/hook/useBriefStoryboardImages';

function stripBriefInternalComments(markdown: string): string {
  return stripBriefSceneMetaComment(stripBriefSequencesComment(markdown));
}

/** Match BriefDialog markdown styling for consistency with brief content modal */
const briefMarkdownComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100 mt-1 mb-0.5 first:mt-0 pb-0.5 border-b border-gray-100 dark:border-gray-800">
      {children}
    </h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-1 mb-0.5 first:mt-0 pb-0.5">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mt-1 mb-0.5 first:mt-0 pb-0.5">{children}</h3>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="my-0.5 text-gray-700 dark:text-gray-300 leading-snug text-sm">{children}</p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="my-0.5 ml-4 list-disc space-y-0.5 text-gray-700 dark:text-gray-300 text-sm">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="my-0.5 ml-4 list-decimal space-y-0.5 text-gray-700 dark:text-gray-300 text-sm">{children}</ol>
  ),
  hr: () => <hr className="my-1 border-t border-dashed border-gray-200 dark:border-gray-700" />,
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="my-0.5 pl-3 border-l-2 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 italic text-sm">
      {children}
    </blockquote>
  ),
};

function normalizeTableDataForSave(
  newTableData: string[][],
  existingTable: { table: string[][] } | null,
): string[][] {
  const firstCell = newTableData[0]?.[0]?.trim() ?? '';
  const isFirstRowData = /^\d+-\d+s$/i.test(firstCell) || /^\d+-\d+\s*s$/i.test(firstCell);
  if (!isFirstRowData || newTableData.length === 0) return newTableData;

  const originalHeader = existingTable?.table[0];
  const headerRow =
    originalHeader && !/^\d+-\d+s$/i.test((originalHeader[0] ?? '').trim())
      ? originalHeader
      : [...DEFAULT_BRIEF_STORYBOARD_HEADERS];
  const colCount = Math.max(headerRow.length, ...newTableData.map((r) => r.length));
  const pad = (arr: string[]) => {
    const a = [...arr];
    while (a.length < colCount) a.push('');
    return a.slice(0, colCount);
  };
  return [pad(headerRow), ...newTableData.map(pad)];
}

function applyTableToBrief(
  brief: string,
  newTableData: string[][],
  existingParsedTable: ReturnType<typeof parseMarkdownTable>,
): string {
  const dataToSave = normalizeTableDataForSave(newTableData, existingParsedTable);
  const newTableMarkdown = stringifyMarkdownTable(dataToSave, {
    trimTrailingEmptyBodyRows: false,
  });
  if (existingParsedTable) {
    return replaceTableInMarkdown(
      brief,
      newTableMarkdown,
      existingParsedTable.startIndex,
      existingParsedTable.endIndex,
    );
  }
  const trimmed = brief.trim();
  if (!trimmed) return newTableMarkdown;
  return `${trimmed}\n\n${newTableMarkdown}`;
}

export interface ContentPlanBriefDisplayProps {
  planId: string;
  brief: string | null | undefined;
}

export const ContentPlanBriefDisplay: React.FC<ContentPlanBriefDisplayProps> = ({ planId, brief }) => {
  const { t } = useAppTranslation();
  const { updateContentPlan } = useSocialMediaMutations();
  const [createTableOpen, setCreateTableOpen] = useState(false);
  const {
    rowImagesMap,
    uploadMany,
    remove,
    insertRow,
    deleteRow,
    uploadingRowIndex,
    deletingImageId,
    isWorking: isStoryboardImagesBusy,
  } = useBriefStoryboardImages(planId);
  const briefText = brief?.trim() ?? '';
  const canUpdate = Boolean(planId && planId !== '__missing_plan_id__');

  const parsedTable = useMemo(() => {
    if (!briefText) return null;
    const parsed = parseMarkdownTable(briefText);
    if (!parsed?.table?.length) return parsed;
    if (isBriefStoryboardTableCanonical(parsed.table)) return parsed;
    return {
      ...parsed,
      table: normalizeBriefStoryboardTable(parsed.table),
    };
  }, [briefText]);

  const persistBrief = (nextBrief: string) => {
    if (!canUpdate) return;
    updateContentPlan(planId, { brief: nextBrief });
  };

  const handleTableSave = (
    newTableData: string[][],
    meta?: { sequences: BriefSequence[]; sceneMeta?: BriefSceneMeta[] },
  ) => {
    let next = applyTableToBrief(briefText, newTableData, parseMarkdownTable(briefText));
    if (meta?.sequences) {
      next = upsertBriefSequencesInMarkdown(next, meta.sequences);
    }
    if (meta?.sceneMeta) {
      next = upsertBriefSceneMetaInMarkdown(next, meta.sceneMeta);
    }
    persistBrief(next);
  };

  const handleCreateStoryboardTable = (tableData: string[][]) => {
    persistBrief(applyTableToBrief(briefText, tableData, null));
    setCreateTableOpen(false);
  };

  const emptyState = (
    <>
      <BriefStoryboardEmptyState onCreateTable={() => setCreateTableOpen(true)} />
      <CreateBriefTableDialog
        open={createTableOpen}
        onOpenChange={setCreateTableOpen}
        onCreate={handleCreateStoryboardTable}
      />
    </>
  );

  if (!briefText) {
    return (
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground italic">
          {t('contentCalendar.dayDialog.noBrief', 'No description')}
        </p>
        {emptyState}
      </div>
    );
  }

  if (!parsedTable) {
    const prose = makeBriefSectionsInline(
      stripBreakdownScriptLabel(removeBriefTitleFromStart(stripBriefInternalComments(briefText))),
    );
    return (
      <div className="min-w-0 space-y-2">
        {prose.trim() ? (
          <div className="prose prose-sm max-w-none prose-p:my-0.5 prose-headings:mt-1 prose-headings:mb-0.5">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={briefMarkdownComponents}>
              {prose}
            </ReactMarkdown>
          </div>
        ) : null}
        {emptyState}
      </div>
    );
  }

  const before = stripBriefInternalComments(briefText.slice(0, parsedTable.startIndex));
  const after = stripBriefInternalComments(briefText.slice(parsedTable.endIndex));

  return (
    <div className="flex min-h-0 min-w-0 flex-col space-y-2">
      {before.trim().length > 0 && (
        <div className="prose prose-sm max-w-none prose-p:my-0.5 prose-headings:mt-1 prose-headings:mb-0.5 flex-shrink-0">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={briefMarkdownComponents}>
            {makeBriefSectionsInline(stripBreakdownScriptLabel(removeBriefTitleFromStart(before)))}
          </ReactMarkdown>
        </div>
      )}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <EditableBriefTable
          tableData={parsedTable.table}
          storyboardToolbar
          sequencesSource={briefText}
          planId={planId}
          rowImagesMap={rowImagesMap}
          onUploadImages={uploadMany}
          onDeleteImage={remove}
          onInsertRowImages={insertRow}
          onDeleteRowImages={deleteRow}
          mediaBusy={isStoryboardImagesBusy}
          uploadingRowIndex={uploadingRowIndex}
          deletingImageId={deletingImageId}
          onSave={handleTableSave}
          className="!my-1"
        />
      </div>
      {after.trim().length > 0 && (
        <div className="prose prose-sm max-w-none mt-1 prose-p:my-0.5 prose-headings:mt-1 prose-headings:mb-0.5 flex-shrink-0">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={briefMarkdownComponents}>
            {after.trim()}
          </ReactMarkdown>
        </div>
      )}
      <CreateBriefTableDialog
        open={createTableOpen}
        onOpenChange={setCreateTableOpen}
        onCreate={handleCreateStoryboardTable}
      />
    </div>
  );
};
