import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftRight, Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { StoryboardActionShell } from "@/6-1-dashboard/modal/StoryboardActionShell";
import { Label } from "@/shared/components/ui/label";
import { cn } from "@/shared/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import type { BriefConceptDocument } from "@/6-1-dashboard/modal/briefConceptAssets";
import {
  durationChoices,
  geminiAspectRatio,
  isOmniVideoModel,
  isVeoVideoModel,
  isVideoProvider,
  modelsForProvider,
  resolutionsForModel,
  UGC_TYPES,
  briefForStoredScene,
  buildVideoPrompt,
  masterPromptWithActiveShots,
  imageRatioDiffers,
  lookIsUgc,
  mentionedConceptHandles,
  missingConceptImages,
  type VideoResolution,
  type ShotBrief,
  type UgcType,
  type VideoModelId,
  type VideoProvider,
  type VideoRatio,
} from "@/6-1-dashboard/lib/seedanceVideo";

export type VideoImageChoice = {
  id: string;
  publicUrl: string;
  width: number | null;
  height: number | null;
  promptOverride: string | null;
  shotText: string | null;
  angleText: string | null;
  visualFunctionText: string | null;
};

export type BriefVideoDraft = {
  scope: "shot" | "master";
  rowIndexes: number[];
  prompt: string;
  look: string;
  needsUgcType: boolean;
  silent: boolean;
  missingMentions: string[];
  missingShots: number[];
  ratio: VideoRatio;
  ratioWarning: boolean;
  masterPrompt: string;
  narration: string;
  shotBrief: ShotBrief | null;
  shotBriefs: ShotBrief[];
  imagesByRow: Record<number, VideoImageChoice[]>;
  initialImageIds: Record<number, string>;
  sourceHeaders: string[];
  sourceRows: string[][];
  concept: BriefConceptDocument | null;
};

function briefWithSelectedImage(brief: ShotBrief, images: VideoImageChoice[], selectedId?: string): ShotBrief {
  const chosen = images.find((image) => image.id === selectedId);
  return briefForStoredScene(brief, chosen);
}

function shotBriefForSelection(draft: BriefVideoDraft, selectedImages: Record<number, string>): ShotBrief {
  const rowIndex = draft.rowIndexes[0] ?? 0;
  const images = draft.imagesByRow[rowIndex] ?? [];
  const selectedId = selectedImages[rowIndex] ?? images[0]?.id;
  return briefWithSelectedImage(
    draft.shotBrief ?? { shot: "", angle: "", visualFunction: "", veoPrompt: "" },
    images,
    selectedId,
  );
}

function BriefPromptField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
      <p className="whitespace-pre-wrap text-sm">{value || "—"}</p>
    </div>
  );
}

function FrameDrop({
  label,
  hint,
  image,
  onDropImage,
}: {
  label: string;
  hint: string;
  image?: VideoImageChoice;
  onDropImage: (imageId: string) => void;
}) {
  return (
    <div
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const imageId = event.dataTransfer.getData("text/plain");
        if (imageId) onDropImage(imageId);
      }}
      className="flex min-h-24 min-w-0 flex-1 flex-col items-center justify-center gap-1 border border-dashed border-gray-400 bg-gray-200 p-2 text-center"
    >
      <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
      {image ? (
        <img src={image.publicUrl} alt="" className="h-16 w-16 object-cover" />
      ) : (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

type Props = {
  draft: BriefVideoDraft | null;
  pending: boolean;
  onClose: () => void;
  onSelectImage?: (rowIndex: number, imageId: string) => void;
  onConfirm: (input: {
    provider: VideoProvider;
    model: VideoModelId;
    resolution: VideoResolution;
    duration: number;
    ugcType: UgcType | null;
    imageIds: Record<number, string>;
    endImageId: string | null;
  }) => void;
};

export function BriefVideoConfirmDialog({ draft, pending, onClose, onSelectImage, onConfirm }: Props) {
  const { t } = useAppTranslation();
  const { organizationId } = useCurrentOrg();
  const { data: savedProvider } = useQuery({
    queryKey: ["video-ai-provider", organizationId],
    enabled: Boolean(organizationId) && Boolean(draft),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_video_ai_config")
        .select("provider")
        .eq("organization_id", organizationId as string)
        .maybeSingle();
      if (error) return "byteplus";
      return isVideoProvider(String(data?.provider ?? "")) ? String(data?.provider) : "byteplus";
    },
  });
  const [provider, setProvider] = useState<VideoProvider>("byteplus");
  const [model, setModel] = useState<VideoModelId>("dreamina-seedance-2-5-260628");
  const [resolution, setResolution] = useState<VideoResolution>("720p");
  const [duration, setDuration] = useState(5);
  const [ugcType, setUgcType] = useState<UgcType | "">("");
  const [selectedImages, setSelectedImages] = useState<Record<number, string>>({});
  const [sceneOn, setSceneOn] = useState(false);
  const [endImageId, setEndImageId] = useState<string | null>(null);
  const [draftKey, setDraftKey] = useState("");
  const storedProvider: VideoProvider = savedProvider === "gemini" ? "gemini" : "byteplus";
  const nextKey = draft
    ? `${storedProvider}:${draft.scope}:${draft.rowIndexes.join(",")}:${draft.look}:${Object.entries(draft.initialImageIds).map(([row, id]) => `${row}:${id}`).join(",")}`
    : "";
  if (nextKey !== draftKey) {
    const initialProvider: VideoProvider = storedProvider;
    const initialModel = modelsForProvider(initialProvider)[0].id;
    setDraftKey(nextKey);
    setProvider(initialProvider);
    setModel(initialModel);
    setResolution("720p");
    setDuration(durationChoices(initialModel)[0] ?? 5);
    setUgcType("");
    setSceneOn(false);
    setEndImageId(null);
    const initial: Record<number, string> = {};
    draft?.rowIndexes.forEach((rowIndex) => {
      const choices = draft.imagesByRow[rowIndex] ?? [];
      const preferred = draft.initialImageIds[rowIndex];
      const image = choices.find((item) => item.id === preferred) ?? choices[0];
      if (image) initial[rowIndex] = image.id;
    });
    setSelectedImages(initial);
  }

  const choices = durationChoices(model, resolution);
  const durationOk = choices.includes(duration);
  const emptyBrief: ShotBrief = { shot: "", angle: "", visualFunction: "", veoPrompt: "" };
  const veoByRow: Record<number, string | null> = {};
  const sceneByRow: Record<number, ShotBrief> = {};
  draft?.rowIndexes.forEach((rowIndex, index) => {
    const choicesForRow = draft.imagesByRow[rowIndex] ?? [];
    const selectedId = selectedImages[rowIndex] ?? choicesForRow[0]?.id;
    const cell = draft.shotBriefs[index] ?? draft.shotBrief ?? emptyBrief;
    const scene = briefWithSelectedImage(cell, choicesForRow, selectedId);
    sceneByRow[rowIndex] = scene;
    if (scene.veoPrompt) veoByRow[rowIndex] = scene.veoPrompt;
  });
  const shotRow = draft?.rowIndexes[0] ?? 0;
  const shotImages = draft?.imagesByRow[shotRow] ?? [];
  const awalId = selectedImages[shotRow] ?? shotImages[0]?.id ?? "";
  const sceneActive = draft?.scope === "shot" && sceneOn;
  const awalBrief = sceneByRow[shotRow] ?? briefWithSelectedImage(draft?.shotBrief ?? emptyBrief, shotImages, awalId);
  const akhirBrief = endImageId ? briefWithSelectedImage(draft?.shotBrief ?? emptyBrief, shotImages, endImageId) : null;
  const liveMissing = draft
    ? missingConceptImages(buildVideoPrompt({
      scope: draft.scope,
      rows: draft.sourceRows,
      headers: draft.sourceHeaders,
      rowIndexes: draft.rowIndexes,
      ugcType: ugcType || null,
      veoByRow,
      sceneByRow,
    }), draft.concept)
    : [];
  const sceneHandles = sceneActive
    ? mentionedConceptHandles(buildVideoPrompt({
      scope: "shot",
      rows: draft?.sourceRows ?? [],
      headers: draft?.sourceHeaders ?? [],
      rowIndexes: draft?.rowIndexes ?? [],
      ugcType: ugcType || null,
      veoByRow,
      sceneByRow,
      endVeo: akhirBrief?.veoPrompt,
      endScene: akhirBrief,
    }))
    : [];
  const sceneReady = !sceneActive || (Boolean(endImageId) && endImageId !== awalId);
  const firstRow = draft?.rowIndexes[0];
  const warningImage = firstRow == null
    ? null
    : (draft?.imagesByRow[firstRow] ?? []).find((image) => image.id === selectedImages[firstRow])
      ?? draft?.imagesByRow[firstRow]?.[0]
      ?? null;
  const ratioWarning = draft ? imageRatioDiffers(warningImage?.width, warningImage?.height, draft.ratio) : false;
  const blocked = (!sceneActive && liveMissing.length > 0) || (draft?.missingShots.length ?? 0) > 0;
  const ugcOk = !draft?.needsUgcType || ugcType !== "";
  const lookLabel = draft && lookIsUgc(draft.look) ? "UGC" : draft?.look ?? "";
  const shownMaster = draft
    ? masterPromptWithActiveShots(
      draft.masterPrompt,
      draft.rowIndexes.map((rowIndex) => sceneByRow[rowIndex] ?? emptyBrief),
    )
    : "";
  const chooseImage = (rowIndex: number, imageId: string) => {
    setSelectedImages((current) => ({ ...current, [rowIndex]: imageId }));
    onSelectImage?.(rowIndex, imageId);
  };
  const selectModel = (value: VideoModelId) => {
    setModel(value);
    const allowed = resolutionsForModel(value);
    const nextResolution = allowed.includes(resolution) ? resolution : "720p";
    if (nextResolution !== resolution) setResolution(nextResolution);
    const nextChoices = durationChoices(value, nextResolution);
    if (!nextChoices.includes(duration)) setDuration(nextChoices[0] ?? 5);
  };
  const selectResolution = (value: VideoResolution) => {
    setResolution(value);
    const nextChoices = durationChoices(model, value);
    if (!nextChoices.includes(duration)) setDuration(nextChoices[0] ?? 8);
  };
  const selectProvider = (value: VideoProvider) => {
    setProvider(value);
    selectModel(modelsForProvider(value)[0].id);
  };
  const modelChoices = modelsForProvider(provider);
  const resolutionChoices = resolutionsForModel(model);
  const geminiHelp = isOmniVideoModel(model)
    ? t("videoAi.confirm.omniHelp", "Memakai API key Script AI. Maksimum 7 gambar. Durasi 4, 6, 8, atau 10 detik.")
    : isVeoVideoModel(model) && (model.includes("lite") || model.startsWith("veo-3.0"))
      ? t("videoAi.confirm.veoLiteHelp", "Memakai API key Script AI. Satu gambar, atau gambar awal dan akhir. 1080p hanya untuk 8 detik.")
      : t("videoAi.confirm.veoHelp", "Memakai API key Script AI. Maksimum 3 gambar. 1080p, 4K, dan beberapa gambar hanya untuk 8 detik.");
  const shownGeminiRatio = draft ? geminiAspectRatio(draft.ratio) : "9:16";

  const keepOpen = (event: { preventDefault: () => void; target: EventTarget | null }) => {
    const target = event.target;
    if (
      target instanceof Element
      && target.closest("[data-radix-popper-content-wrapper], [data-radix-select-content]")
    ) {
      event.preventDefault();
    }
  };

  return (
    <StoryboardActionShell
      open={Boolean(draft)}
      onOpenChange={(open) => { if (!open && !pending) onClose(); }}
      title={t("videoAi.confirm.title", "Generate video")}
      keepOpen={keepOpen}
      footerClassName="shrink-0 items-center sm:justify-between"
      headerExtra={(
        <div className="space-y-0.5 text-left">
          <p className="text-[11px] font-semibold text-muted-foreground">{t("videoAi.confirm.narration", "Narasi")}</p>
          <p className="max-h-24 overflow-y-auto whitespace-pre-wrap text-sm text-foreground [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {draft?.narration || "—"}
          </p>
        </div>
      )}
      footer={(
        <>
          <p className="text-left text-sm text-muted-foreground">
            {draft?.scope === "master"
              ? t("videoAi.confirm.master", "Satu video untuk {{count}} shot di Master Prompt ini.", { count: draft.rowIndexes.length })
              : t("videoAi.confirm.shot", "Satu video dari gambar shot ini.")}
          </p>
          <div className="flex shrink-0 justify-end gap-2">
            <Button type="button" variant="outline" className="rounded-none" disabled={pending} onClick={onClose}>{t("videoAi.confirm.cancel", "Batal")}</Button>
            <Button
              type="button"
              className="rounded-none"
              disabled={!draft || pending || blocked || !durationOk || !ugcOk || !sceneReady}
              onClick={() => onConfirm({
                provider,
                model,
                resolution,
                duration,
                ugcType: ugcType || null,
                imageIds: selectedImages,
                endImageId: sceneActive ? endImageId : null,
              })}
            >
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("briefDialog.imagePrompt.regenerate", "Regenerate")}
            </Button>
          </div>
        </>
      )}
    >
        {draft ? (
          <div className="space-y-3">
            {draft.scope === "master" ? (
              <div className="space-y-2">
                <div className="space-y-0.5 rounded-none border border-border bg-muted/40 px-3 py-2">
                  <p className="text-[11px] font-semibold text-muted-foreground">{t("videoAi.confirm.masterPrompt", "Master prompt")}</p>
                  <p className="whitespace-pre-wrap text-sm">{shownMaster || "—"}</p>
                </div>
                {draft.shotBriefs.map((brief, index) => {
                  const rowIndex = draft.rowIndexes[index] ?? index;
                  const imageChoices = draft.imagesByRow[rowIndex] ?? [];
                  const selectedId = selectedImages[rowIndex] ?? imageChoices[0]?.id;
                  const shown = sceneByRow[rowIndex] ?? briefWithSelectedImage(brief, imageChoices, selectedId);
                  return (
                  <div key={`${brief.shot}-${index}`} className="space-y-2 rounded-none border border-border bg-muted/40 px-3 py-2">
                    {imageChoices.length > 0 ? (
                      <div className="space-y-1">
                        <p className="text-[11px] font-semibold text-muted-foreground">{t("videoAi.confirm.pickAngle", "Pilih angle gambar")}</p>
                        <div className="flex w-full min-w-0 flex-nowrap gap-2 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                          {imageChoices.map((image, imageIndex) => (
                            <button
                              key={image.id}
                              type="button"
                              aria-pressed={selectedId === image.id}
                              aria-label={t("videoAi.confirm.angleImage", "Gambar {{index}}", { index: imageIndex + 1 })}
                              onClick={() => chooseImage(rowIndex, image.id)}
                              className={cn(
                                "h-16 w-16 shrink-0 overflow-hidden border bg-white",
                                selectedId === image.id ? "border-primary ring-2 ring-primary" : "border-input",
                              )}
                            >
                              <img src={image.publicUrl} alt="" className="h-full w-full object-cover" />
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {(
                      [
                        ["videoAi.confirm.shotField", "Shot", shown.shot],
                        ["videoAi.confirm.angle", "Angle", shown.angle],
                        ["videoAi.confirm.visualFunction", "Visual function", shown.visualFunction],
                        ["videoAi.confirm.veo", "Veo 3 prompt", shown.veoPrompt],
                      ] as const
                    ).map(([key, fallback, value]) => (
                      <div key={key} className="space-y-0.5">
                        <p className="text-[11px] font-semibold text-muted-foreground">{t(key, fallback)}</p>
                        <p className="whitespace-pre-wrap text-sm">{value || "—"}</p>
                      </div>
                    ))}
                  </div>
                  );
                })}
              </div>
            ) : null}
            {draft.scope === "shot" && draft.shotBrief ? (
              <div className="space-y-2 rounded-none border border-border bg-muted/40 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold text-muted-foreground">{t("videoAi.confirm.scene", "Scene")}</p>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={sceneOn}
                    aria-label={t("videoAi.confirm.scene", "Scene")}
                    onClick={() => setSceneOn((current) => !current)}
                    className={cn(
                      "inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors",
                      sceneOn ? "justify-end bg-primary" : "justify-start bg-gray-300",
                    )}
                  >
                    <span className="block h-5 w-5 rounded-full bg-white shadow-sm" />
                  </button>
                </div>
                {sceneActive ? (
                  <>
                    <div className="flex w-full min-w-0 flex-nowrap gap-2 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {shotImages.map((image, imageIndex) => (
                        <button
                          key={image.id}
                          type="button"
                          draggable
                          aria-label={t("videoAi.confirm.angleImage", "Gambar {{index}}", { index: imageIndex + 1 })}
                          onDragStart={(event) => {
                            event.dataTransfer.setData("text/plain", image.id);
                            event.dataTransfer.effectAllowed = "copy";
                          }}
                          className="h-16 w-16 shrink-0 cursor-grab overflow-hidden border border-input bg-white active:cursor-grabbing"
                        >
                          <img src={image.publicUrl} alt="" className="pointer-events-none h-full w-full object-cover" draggable={false} />
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <FrameDrop
                        label={t("videoAi.confirm.sceneStart", "Awal")}
                        hint={t("videoAi.confirm.sceneDrop", "Jatuhkan gambar dari shot ini")}
                        image={shotImages.find((image) => image.id === awalId)}
                        onDropImage={(imageId) => {
                          if (!shotImages.some((image) => image.id === imageId)) return;
                          chooseImage(shotRow, imageId);
                          if (imageId === endImageId) setEndImageId(null);
                        }}
                      />
                      <button
                        type="button"
                        aria-label={t("videoAi.confirm.sceneSwap", "Tukar Awal dan Akhir")}
                        title={t("videoAi.confirm.sceneSwap", "Tukar Awal dan Akhir")}
                        disabled={!endImageId || endImageId === awalId}
                        onClick={() => {
                          if (!endImageId || endImageId === awalId) return;
                          const nextStart = endImageId;
                          const nextEnd = awalId;
                          chooseImage(shotRow, nextStart);
                          setEndImageId(nextEnd);
                        }}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-400 bg-gray-300 text-gray-700 hover:bg-gray-400 disabled:opacity-40"
                      >
                        <ArrowLeftRight className="h-4 w-4" />
                      </button>
                      <FrameDrop
                        label={t("videoAi.confirm.sceneEnd", "Akhir")}
                        hint={t("videoAi.confirm.sceneDrop", "Jatuhkan gambar dari shot ini")}
                        image={shotImages.find((image) => image.id === endImageId)}
                        onDropImage={(imageId) => {
                          if (!shotImages.some((image) => image.id === imageId) || imageId === awalId) return;
                          setEndImageId(imageId);
                        }}
                      />
                    </div>
                    <p className="text-[11px] font-semibold text-foreground">{t("videoAi.confirm.sceneStart", "Awal")}</p>
                    {(
                      [
                        ["videoAi.confirm.shotField", "Shot", awalBrief.shot],
                        ["videoAi.confirm.angle", "Angle", awalBrief.angle],
                        ["videoAi.confirm.visualFunction", "Visual function", awalBrief.visualFunction],
                        ["videoAi.confirm.veo", "Veo 3 prompt", awalBrief.veoPrompt],
                      ] as const
                    ).map(([key, fallback, value]) => (
                      <BriefPromptField key={`start-${key}`} label={t(key, fallback)} value={value} />
                    ))}
                    {akhirBrief ? (
                      <>
                        <p className="text-[11px] font-semibold text-foreground">{t("videoAi.confirm.sceneEnd", "Akhir")}</p>
                        {(
                          [
                            ["videoAi.confirm.angle", "Angle", akhirBrief.angle],
                            ["videoAi.confirm.visualFunction", "Visual function", akhirBrief.visualFunction],
                            ["videoAi.confirm.veo", "Veo 3 prompt", akhirBrief.veoPrompt],
                          ] as const
                        ).map(([key, fallback, value]) => (
                          <BriefPromptField key={`end-${key}`} label={t(key, fallback)} value={value} />
                        ))}
                      </>
                    ) : null}
                  </>
                ) : (
                  (
                    [
                      ["videoAi.confirm.shotField", "Shot", shotBriefForSelection(draft, selectedImages).shot],
                      ["videoAi.confirm.angle", "Angle", shotBriefForSelection(draft, selectedImages).angle],
                      ["videoAi.confirm.visualFunction", "Visual function", shotBriefForSelection(draft, selectedImages).visualFunction],
                      ["videoAi.confirm.veo", "Veo 3 prompt", shotBriefForSelection(draft, selectedImages).veoPrompt],
                    ] as const
                  ).map(([key, fallback, value]) => (
                    <BriefPromptField key={key} label={t(key, fallback)} value={value} />
                  ))
                )}
              </div>
            ) : null}
            <div className="space-y-1">
              <Label id="video-provider-label">{t("videoAi.confirm.provider", "Provider")}</Label>
              <div role="tablist" aria-labelledby="video-provider-label" className="grid grid-cols-2 gap-2">
                {(["byteplus", "gemini"] as const).map((id) => (
                  <Button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={provider === id}
                    variant={provider === id ? "default" : "outline"}
                    className="h-10 rounded-none"
                    onClick={() => selectProvider(id)}
                  >
                    {id === "byteplus" ? "BytePlus" : "Gemini"}
                  </Button>
                ))}
              </div>
              {provider === "gemini" ? (
                <p className="text-xs text-muted-foreground">{geminiHelp}</p>
              ) : null}
            </div>
            <div className="space-y-1">
              <Label>{t("videoAi.confirm.model", "Model")}</Label>
              <Select value={model} onValueChange={(value) => selectModel(value as VideoModelId)}>
                <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
                <SelectContent className="z-[200]">
                  {modelChoices.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t("videoAi.confirm.look", "Look")}</Label>
              <p className="rounded-none border border-border bg-muted/40 px-3 py-2 text-sm">
                {lookLabel || t("videoAi.confirm.lookEmpty", "Master Prompt tidak menulis Look.")}
              </p>
            </div>
            {draft.needsUgcType ? (
              <div className="space-y-1">
                <Label>{t("videoAi.confirm.ugc", "UGC Type")}</Label>
                <Select value={ugcType || undefined} onValueChange={(value) => setUgcType(value as UgcType)}>
                  <SelectTrigger className="rounded-none"><SelectValue placeholder={t("videoAi.confirm.ugcPick", "Pilih tipe UGC")} /></SelectTrigger>
                  <SelectContent className="z-[200]">
                    {UGC_TYPES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div className="space-y-1">
              <Label>{t("videoAi.confirm.resolution", "Resolution")}</Label>
              <Select value={resolution} onValueChange={(value) => selectResolution(value as VideoResolution)}>
                <SelectTrigger className="rounded-none"><SelectValue /></SelectTrigger>
                <SelectContent className="z-[200]">
                  {resolutionChoices.map((item) => <SelectItem key={item} value={item}>{item === "4k" ? "4K" : item}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t("videoAi.confirm.duration", "Durasi (detik)")}</Label>
              <div className="grid grid-cols-3 gap-2" role="group" aria-label={t("videoAi.confirm.duration", "Durasi (detik)")}>
                {choices.map((seconds) => (
                  <button
                    key={seconds}
                    type="button"
                    aria-pressed={duration === seconds}
                    onClick={() => setDuration(seconds)}
                    className={cn(
                      "h-10 rounded-none border text-sm font-medium transition-colors",
                      duration === seconds
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-background hover:bg-muted",
                    )}
                  >
                    {seconds}s
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {draft.silent
                ? t("videoAi.confirm.silent", "Audio di Master Prompt melarang bunyi, jadi video dibuat senyap.")
                : t("videoAi.confirm.sound", "Video dibuat dengan bunyi.")}
              {" "}
              {provider === "gemini" && shownGeminiRatio !== draft.ratio
                ? t("videoAi.confirm.geminiRatio", "Gemini memakai rasio 9:16 untuk brief {{ratio}} ini.", { ratio: draft.ratio })
                : sceneActive && model === "dreamina-seedance-2-5-260628"
                ? t("videoAi.confirm.sceneRatio", "Seedance 2.5 mengikuti bentuk gambar Awal.")
                : t("videoAi.confirm.ratio", "Rasio {{ratio}}.", { ratio: provider === "gemini" ? shownGeminiRatio : draft.ratio })}
            </p>
            {ratioWarning && provider === "byteplus" && !(sceneActive && model === "dreamina-seedance-2-5-260628") ? (
              <p className="text-xs text-amber-700">
                {t("videoAi.confirm.ratioWarning", "Gambar belum sebentuk dengan rasio ini. Seedance 2.5 pada satu gambar mengikuti bentuk gambar.")}
              </p>
            ) : null}
            {sceneActive ? (
              <p className="text-xs text-amber-700">
                {sceneHandles.length > 0
                  ? t("videoAi.confirm.sceneConceptHandles", "Foto Concept untuk {{handles}} tidak dikirim.", { handles: sceneHandles.join(", ") })
                  : t("videoAi.confirm.sceneConcept", "Foto Concept tidak dikirim. Video memakai gambar Awal dan Akhir saja.")}
              </p>
            ) : null}
            {draft.missingShots.length > 0 ? (
              <p className="text-xs text-destructive">
                {t("videoAi.confirm.missingShots", "Gambar belum ada di shot {{shots}}.", { shots: draft.missingShots.join(", ") })}
              </p>
            ) : null}
            {!sceneActive && liveMissing.length > 0 ? (
              <p className="text-xs text-destructive">
                {t("videoAi.confirm.missingMentions", "Gambar Concept belum ada untuk {{handles}}.", { handles: liveMissing.join(", ") })}
              </p>
            ) : null}
            {draft.needsUgcType && ugcType === "" ? (
              <p className="text-xs text-destructive">
                {t("videoAi.confirm.ugcRequired", "Pilih tipe UGC dulu.")}
              </p>
            ) : null}
          </div>
        ) : null}
    </StoryboardActionShell>
  );
}
