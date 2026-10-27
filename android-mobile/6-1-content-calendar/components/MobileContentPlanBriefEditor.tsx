import { useMemo, useState } from "react";
import {
  parseMarkdownTable,
  replaceTableInMarkdown,
  stringifyMarkdownTable,
} from "@/6-1-dashboard/utils/markdownTableUtils";
import { EditableBriefTable } from "@/6-1-dashboard/modal/EditableBriefTable";
import { BriefStoryboardEmptyState } from "@/6-1-dashboard/modal/BriefStoryboardEmptyState";
import { CreateBriefTableDialog } from "@/6-1-dashboard/modal/CreateBriefTableDialog";
import {
  isBriefStoryboardTableCanonical,
  normalizeBriefStoryboardTable,
} from "@/6-1-dashboard/modal/briefStoryboardConstants";
import { upsertBriefSequencesInMarkdown, type BriefSequence } from "@/6-1-dashboard/modal/briefSequences";
import {
  upsertBriefSceneMetaInMarkdown,
  type BriefSceneMeta,
} from "@/6-1-dashboard/modal/briefSceneMeta";
import { useBriefStoryboardImages } from "@/6-1-dashboard/hook/useBriefStoryboardImages";
import { useSocialMediaMutations } from "@/6-1-dashboard/hook/useOptimizedSocialMediaState";
import { useBriefExtended } from "@/6-1-dashboard/hook/useBriefExtended";
import { parseBriefConcept } from "@/6-1-dashboard/modal/briefConceptAssets";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";

type Props = {
  planId: string;
  brief: string | null | undefined;
  title?: string | null;
  contentTypeName?: string | null;
  organizationId?: string | null;
};

/**
 * SSoT brief editor for mobile calendar: same table/board + images as desktop BriefDialog.
 */
export function MobileContentPlanBriefEditor({
  planId,
  brief,
  title,
  contentTypeName,
  organizationId,
}: Props) {
  const { updateContentPlan } = useSocialMediaMutations();
  const { organizationId: currentOrgId } = useCurrentOrg();
  const { targetAudience, caption } = useBriefExtended(planId, true);
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

  const briefText = brief?.trim() ?? "";
  const canUpdate = Boolean(planId && planId !== "__missing_plan_id__");
  const concept = useMemo(() => parseBriefConcept(targetAudience ?? ""), [targetAudience]);
  const film = useMemo(
    () => ({
      title: title ?? "",
      caption: caption ?? "",
      storyboard: brief ?? "",
      contentTypeName: contentTypeName ?? "",
      postAspect: concept?.postAspect,
      concept,
      organizationId: organizationId ?? currentOrgId ?? undefined,
    }),
    [title, caption, brief, contentTypeName, concept, organizationId, currentOrgId],
  );

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

  const handleCreateStoryboardTable = (tableData: string[][]) => {
    const markdown = stringifyMarkdownTable(tableData, { trimTrailingEmptyBodyRows: false });
    const existing = parseMarkdownTable(briefText);
    const next = existing
      ? replaceTableInMarkdown(briefText, markdown, existing.startIndex, existing.endIndex)
      : briefText
        ? `${briefText}\n\n${markdown}`
        : markdown;
    persistBrief(next);
    setCreateTableOpen(false);
  };

  const createTableDialog = (
    <CreateBriefTableDialog
      open={createTableOpen}
      onOpenChange={setCreateTableOpen}
      onCreate={handleCreateStoryboardTable}
    />
  );

  if (!parsedTable?.table?.length) {
    return (
      <div className="flex min-h-0 flex-1 flex-col px-2">
        <BriefStoryboardEmptyState onCreateTable={() => setCreateTableOpen(true)} />
        {createTableDialog}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden px-2 pb-2">
      <EditableBriefTable
        tableData={parsedTable.table}
        storyboardToolbar
        phoneFrame
        sequencesSource={briefText}
        planId={planId}
        film={film}
        rowImagesMap={rowImagesMap}
        onUploadImages={uploadMany}
        onDeleteImage={remove}
        onInsertRowImages={insertRow}
        onDeleteRowImages={deleteRow}
        mediaBusy={isStoryboardImagesBusy}
        uploadingRowIndex={uploadingRowIndex}
        deletingImageId={deletingImageId}
        className="!my-0 h-full min-h-0 min-w-0 w-full flex-1"
        onSave={(
          newTableData,
          meta?: { sequences: BriefSequence[]; sceneMeta?: BriefSceneMeta[] },
        ) => {
          const newTableMarkdown = stringifyMarkdownTable(newTableData, {
            trimTrailingEmptyBodyRows: false,
          });
          let nextBrief = replaceTableInMarkdown(
            briefText,
            newTableMarkdown,
            parsedTable.startIndex,
            parsedTable.endIndex,
          );
          if (meta?.sequences) {
            nextBrief = upsertBriefSequencesInMarkdown(nextBrief, meta.sequences);
          }
          if (meta?.sceneMeta) {
            nextBrief = upsertBriefSceneMetaInMarkdown(nextBrief, meta.sceneMeta);
          }
          persistBrief(nextBrief);
        }}
      />
      {createTableDialog}
    </div>
  );
}
