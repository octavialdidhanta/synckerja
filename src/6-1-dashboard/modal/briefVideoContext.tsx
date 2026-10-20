import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clapperboard } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { supabase } from "@/shared/lib/supabaseClient";
import { readEdgeFunctionError } from "@/shared/ai/geminiSpendCap";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { BRIEF_STORYBOARD_IMAGES_BUCKET, type BriefStoryboardImageWithUrl } from "@/6-1-dashboard/hook/useBriefStoryboardImages";
import type { StoryboardFilmContext } from "@/6-1-dashboard/lib/generateBriefSceneImage";
import {
  audioForbidden,
  buildVideoPrompt,
  coveringMasterRow,
  imageRatioDiffers,
  lookIsUgc,
  missingConceptImages,
  readLook,
  readNarration,
  readShotBrief,
  videoRatioForContent,
  type SeedanceModelId,
  type SeedanceResolution,
  type UgcType,
} from "@/6-1-dashboard/lib/seedanceVideo";
import { BriefVideoConfirmDialog, type BriefVideoDraft } from "@/6-1-dashboard/modal/BriefVideoConfirmDialog";

export type BriefShotVideo = {
  id: string;
  scope: "shot" | "master";
  row_index: number;
  row_indexes: number[];
  status: "queued" | "running" | "succeeded" | "failed";
  storage_path: string | null;
  error: string | null;
  created_at: string;
};

type VideoStatus = { phase: "idle" | "working" | "ready" | "failed"; url: string | null; error: string | null };

type BriefVideoContextValue = {
  enabled: boolean;
  openShot: (rowIndex: number, imageId?: string) => void;
  openMaster: (rowIndex: number) => void;
  statusFor: (rowIndex: number) => VideoStatus;
};

const BriefVideoContext = createContext<BriefVideoContextValue | null>(null);

export function useBriefVideo(): BriefVideoContextValue | null {
  return useContext(BriefVideoContext);
}

function videoUrl(path: string | null): string | null {
  if (!path) return null;
  return supabase.storage.from(BRIEF_STORYBOARD_IMAGES_BUCKET).getPublicUrl(path).data.publicUrl;
}

export function BriefVideoProvider({
  planId,
  headers,
  rows,
  film,
  imagesByRow,
  masterSpans,
  children,
}: {
  planId?: string;
  headers: string[];
  rows: string[][];
  film?: StoryboardFilmContext;
  imagesByRow: Record<number, BriefStoryboardImageWithUrl[]>;
  masterSpans: Array<{ row: number; span: number }>;
  children: ReactNode;
}) {
  const { t } = useAppTranslation();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<BriefVideoDraft | null>(null);
  const [pending, setPending] = useState(false);
  const query = useQuery({
    queryKey: ["brief-shot-videos", planId],
    enabled: Boolean(planId),
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brief_shot_videos")
        .select("id, scope, row_index, row_indexes, status, storage_path, error, created_at")
        .eq("social_media_plan_id", planId as string)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as BriefShotVideo[];
    },
  });
  const videos = query.data ?? [];
  const activeKey = videos
    .filter((video) => video.status === "queued" || video.status === "running")
    .map((video) => video.id)
    .sort()
    .join(",");

  useEffect(() => {
    if (!planId || !activeKey) return;
    let stopped = false;
    const refresh = async () => {
      await Promise.all(activeKey.split(",").map(async (videoId) => {
        const { data, error } = await supabase.functions.invoke("generate-brief-video", {
          body: { action: "status", videoId },
        });
        if (stopped) return;
        await readEdgeFunctionError(data, error);
      }));
      if (!stopped) await queryClient.invalidateQueries({ queryKey: ["brief-shot-videos", planId] });
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 8000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [activeKey, planId, queryClient]);

  const groupFor = (rowIndex: number) => {
    const span = masterSpans.find((item) => item.row === rowIndex);
    if (!span) return [rowIndex];
    return Array.from({ length: span.span }, (_, offset) => span.row + offset);
  };

  const makeDraft = (scope: "shot" | "master", rowIndex: number, imageId?: string): BriefVideoDraft => {
    const rowIndexes = scope === "master" ? groupFor(rowIndex) : [rowIndex];
    const anchor = coveringMasterRow(rows, headers, rowIndexes[0] ?? rowIndex);
    const masterColumn = headers.findIndex((header) => header.trim().toLowerCase() === "master prompt");
    const master = masterColumn >= 0 ? String(rows[anchor]?.[masterColumn] ?? "") : "";
    const prompt = buildVideoPrompt({
      scope,
      rows,
      headers,
      rowIndexes,
      ugcType: null,
    });
    const look = readLook(master);
    const ratio = videoRatioForContent(film?.contentTypeName ?? "", film?.postAspect);
    const firstImage = imagesByRow[rowIndexes[0] ?? rowIndex]?.[0];
    const missingShots = rowIndexes.filter((index) => (imagesByRow[index]?.length ?? 0) === 0).map((index) => index + 1);
    return {
      scope,
      rowIndexes,
      prompt,
      look,
      needsUgcType: lookIsUgc(look),
      silent: audioForbidden(master),
      missingMentions: missingConceptImages(prompt, film?.concept),
      missingShots,
      ratio,
      ratioWarning: imageRatioDiffers(firstImage?.width, firstImage?.height, ratio),
      masterPrompt: master,
      narration: readNarration(headers, rows, rowIndexes),
      shotBrief: scope === "shot" ? readShotBrief(headers, rows[rowIndex] ?? []) : null,
      shotBriefs: rowIndexes.map((index) => readShotBrief(headers, rows[index] ?? [])),
      imagesByRow: Object.fromEntries(rowIndexes.map((index) => [
        index,
        (imagesByRow[index] ?? []).map((image) => ({
          id: image.id,
          publicUrl: image.publicUrl,
          width: image.width,
          height: image.height,
          promptOverride: image.prompt_override?.trim() || null,
        })),
      ])),
      initialImageIds: imageId ? { [rowIndex]: imageId } : {},
      sourceHeaders: headers,
      sourceRows: rows,
      concept: film?.concept ?? null,
    };
  };

  const statusFor = (rowIndex: number): VideoStatus => {
    const matching = videos.filter((video) => (video.row_indexes ?? []).includes(rowIndex));
    const latest = matching[0];
    if (!latest) return { phase: "idle", url: null, error: null };
    const ready = matching.find((video) => video.status === "succeeded" && video.storage_path);
    const url = ready ? videoUrl(ready.storage_path) : null;
    if (latest.status === "queued" || latest.status === "running") return { phase: "working", url, error: null };
    if (latest.status === "succeeded") return { phase: "ready", url, error: null };
    return { phase: url ? "ready" : "failed", url, error: latest.error };
  };

  const value = useMemo<BriefVideoContextValue>(() => ({
    enabled: Boolean(planId && film),
    openShot: (rowIndex, imageId) => { if (planId && film) setDraft(makeDraft("shot", rowIndex, imageId)); },
    openMaster: (rowIndex) => { if (planId && film) setDraft(makeDraft("master", rowIndex)); },
    statusFor,
  }), [planId, videos, headers, rows, film, imagesByRow, masterSpans]);

  const confirm = async (input: { model: SeedanceModelId; resolution: SeedanceResolution; duration: number; ugcType: UgcType | null; imageIds: Record<number, string>; endImageId: string | null }) => {
    if (!draft || !planId) return;
    setPending(true);
    try {
      const veoByRow: Record<number, string | null> = {};
      draft.rowIndexes.forEach((rowIndex) => {
        const imageId = input.imageIds[rowIndex];
        const image = (imagesByRow[rowIndex] ?? []).find((item) => item.id === imageId);
        const text = image?.prompt_override?.trim();
        if (text) veoByRow[rowIndex] = text;
      });
      const shotRow = draft.rowIndexes[0] ?? 0;
      const endImage = input.endImageId && draft.scope === "shot"
        ? (imagesByRow[shotRow] ?? []).find((item) => item.id === input.endImageId)
        : undefined;
      const endVeo = input.endImageId && draft.scope === "shot"
        ? endImage?.prompt_override?.trim() || readShotBrief(headers, rows[shotRow] ?? []).veoPrompt
        : null;
      const prompt = buildVideoPrompt({
        scope: draft.scope,
        rows,
        headers,
        rowIndexes: draft.rowIndexes,
        ugcType: input.ugcType,
        veoByRow,
        endVeo,
      });
      const { data, error } = await supabase.functions.invoke("generate-brief-video", {
        body: {
          action: "create",
          planId,
          scope: draft.scope,
          rowIndexes: draft.rowIndexes,
          model: input.model,
          resolution: input.resolution,
          duration: input.duration,
          ratio: draft.ratio,
          generateAudio: !draft.silent,
          prompt,
          imageIds: input.imageIds,
          endImageId: draft.scope === "shot" ? input.endImageId : null,
        },
      });
      const message = await readEdgeFunctionError(data, error);
      if (message && !data?.video) {
        toast.error(message);
        return;
      }
      setDraft(null);
      toast.success(t("videoAi.confirm.started", "Video sedang dibuat."));
      await queryClient.invalidateQueries({ queryKey: ["brief-shot-videos", planId] });
    } finally {
      setPending(false);
    }
  };

  return (
    <BriefVideoContext.Provider value={value}>
      {children}
      <BriefVideoConfirmDialog draft={draft} pending={pending} onClose={() => setDraft(null)} onConfirm={(input) => void confirm(input)} />
    </BriefVideoContext.Provider>
  );
}

export function BriefMasterVideoButton({ rowIndex, className }: { rowIndex: number; className?: string }) {
  const video = useBriefVideo();
  const { t } = useAppTranslation();
  if (!video?.enabled) return null;
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className={className}
      aria-label={t("videoAi.confirm.masterButton", "Generate video dari Master Prompt")}
      title={t("videoAi.confirm.masterButton", "Generate video dari Master Prompt")}
      onClick={(event) => {
        event.stopPropagation();
        video.openMaster(rowIndex);
      }}
    >
      <Clapperboard className="h-3.5 w-3.5" />
    </Button>
  );
}
