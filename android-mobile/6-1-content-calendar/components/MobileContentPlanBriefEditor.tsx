import { useMemo } from "react";
import {
  parseMarkdownTable,
  replaceTableInMarkdown,
  stringifyMarkdownTable,
} from "@/6-1-dashboard/utils/markdownTableUtils";
import { EditableBriefTable } from "@/6-1-dashboard/modal/EditableBriefTable";
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
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";

type Props = {
  planId: string;
  brief: string | null | undefined;
};

/**
 * SSoT brief editor for mobile calendar: same table/board + images as desktop BriefDialog.
 */
export function MobileContentPlanBriefEditor({ planId, brief }: Props) {
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

  const briefText = brief?.trim() ?? "";

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
      <p className="px-1 py-6 text-center text-sm text-muted-foreground">
        {t("contentCalendar.dayDialog.noBrief", "No description")}
      </p>
    );
  }

  if (!parsedTable?.table?.length) {
    return (
      <p className="px-1 py-6 text-center text-sm text-muted-foreground">
        {t(
          "contentCalendar.mobile.noStoryboardTable",
          "No storyboard table in this brief yet.",
        )}
      </p>
    );
  }

  const canUpdate = Boolean(planId && planId !== "__missing_plan_id__");

  return (
    <EditableBriefTable
      tableData={parsedTable.table}
      storyboardToolbar
      density="mobile-2col"
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
      className="!my-0 !max-h-none min-h-0 flex-1"
      onSave={(
        newTableData,
        meta?: { sequences: BriefSequence[]; sceneMeta?: BriefSceneMeta[] },
      ) => {
        if (!canUpdate) return;
        const newTableMarkdown = stringifyMarkdownTable(newTableData);
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
        updateContentPlan(planId, { brief: nextBrief });
      }}
    />
  );
}
