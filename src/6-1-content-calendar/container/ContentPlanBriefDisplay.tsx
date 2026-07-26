import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { parseMarkdownTable, replaceTableInMarkdown, stringifyMarkdownTable } from '@/6-1-dashboard/utils/markdownTableUtils';
import { EditableBriefTable } from '@/6-1-dashboard/modal/EditableBriefTable';
import {
  isBriefStoryboardTableCanonical,
  normalizeBriefStoryboardTable,
} from '@/6-1-dashboard/modal/briefStoryboardConstants';
import {
  stripBreakdownScriptLabel,
  removeBriefTitleFromStart,
  makeBriefSectionsInline,
} from '@/shared/utils/briefUtils';
import { useAppTranslation } from '@/shared/i18n/useAppTranslation';
import { useSocialMediaMutations } from '@/6-1-dashboard/hook/useOptimizedSocialMediaState';
import { useBriefStoryboardImages } from '@/6-1-dashboard/hook/useBriefStoryboardImages';

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

export interface ContentPlanBriefDisplayProps {
  planId: string;
  brief: string | null | undefined;
}

export const ContentPlanBriefDisplay: React.FC<ContentPlanBriefDisplayProps> = ({ planId, brief }) => {
  const { t } = useAppTranslation();
  const { updateContentPlan } = useSocialMediaMutations();
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

  if (!briefText) {
    return (
      <p className="text-sm text-muted-foreground italic">
        {t('contentCalendar.dayDialog.noBrief', 'No description')}
      </p>
    );
  }

  if (!parsedTable) {
    return (
      <div className="prose prose-sm max-w-none prose-p:my-0.5 prose-headings:mt-1 prose-headings:mb-0.5">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={briefMarkdownComponents}>
          {makeBriefSectionsInline(stripBreakdownScriptLabel(removeBriefTitleFromStart(briefText)))}
        </ReactMarkdown>
      </div>
    );
  }

  const before = briefText.slice(0, parsedTable.startIndex);
  const after = briefText.slice(parsedTable.endIndex);
  const canUpdate = Boolean(planId && planId !== '__missing_plan_id__');

  return (
    <div className="space-y-2 min-w-0">
      {before.trim().length > 0 && (
        <div className="prose prose-sm max-w-none prose-p:my-0.5 prose-headings:mt-1 prose-headings:mb-0.5 flex-shrink-0">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={briefMarkdownComponents}>
            {makeBriefSectionsInline(stripBreakdownScriptLabel(removeBriefTitleFromStart(before)))}
          </ReactMarkdown>
        </div>
      )}
      <div className="min-w-0 -mx-1">
        <EditableBriefTable
          tableData={parsedTable.table}
          controlsPlacement="taggingColumn"
          planId={planId}
          rowImagesMap={rowImagesMap}
          onUploadImages={uploadMany}
          onDeleteImage={remove}
          onInsertRowImages={insertRow}
          onDeleteRowImages={deleteRow}
          mediaBusy={isStoryboardImagesBusy}
          uploadingRowIndex={uploadingRowIndex}
          deletingImageId={deletingImageId}
          onSave={(newTableData) => {
            if (!canUpdate) return;
            const newTableMarkdown = stringifyMarkdownTable(newTableData);
            const nextBrief = replaceTableInMarkdown(
              briefText,
              newTableMarkdown,
              parsedTable.startIndex,
              parsedTable.endIndex
            );
            updateContentPlan(planId, { brief: nextBrief });
          }}
          className="!my-1 !max-h-[min(480px,52vh)]"
        />
      </div>
      {after.trim().length > 0 && (
        <div className="prose prose-sm max-w-none mt-1 prose-p:my-0.5 prose-headings:mt-1 prose-headings:mb-0.5 flex-shrink-0">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={briefMarkdownComponents}>
            {after.trim()}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
};
