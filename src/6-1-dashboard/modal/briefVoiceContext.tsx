import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AudioLines, ChevronDown, Download, Loader2, Pause, Play, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { Slider } from "@/shared/components/ui/slider";
import { Switch } from "@/shared/components/ui/switch";
import { voiceModelSupportsAudioTags } from "../../../supabase/functions/_shared/voiceAudioTags.ts";
import { cn } from "@/shared/lib/utils";
import { supabase } from "@/shared/lib/supabaseClient";
import { isGeminiSpendCapMessage, readEdgeFunctionError } from "@/shared/ai/geminiSpendCap";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { BRIEF_STORYBOARD_IMAGES_BUCKET } from "@/6-1-dashboard/hook/useBriefStoryboardImages";
import { useBriefVideo } from "@/6-1-dashboard/modal/briefVideoContext";
import { VOICE_LANGUAGES, voiceModelLabel, voiceModelUsesLanguage, voiceModelUsesSpeed } from "@/6-1-dashboard/lib/voiceModels";
import { clipForNarration } from "@/6-1-dashboard/modal/briefVoVersions";

type VoiceSettings = {
  api_key_configured: boolean;
  voice_id: string | null;
  voice_name: string | null;
  tts_model: string;
  language_code: string;
  stability: number;
  similarity_boost: number;
  speed: number;
  auto_tag: boolean;
};

type VoiceClip = {
  id: string;
  kind: "vo" | "seedance";
  row_index: number;
  video_id: string | null;
  storage_path: string;
  file_name: string;
  spoken_text: string | null;
  created_at: string;
  url: string;
};

type BriefVoiceContextValue = {
  planId?: string;
  canGenerate: boolean;
  settings: VoiceSettings | null;
  voClip: (rowIndex: number, narration: string) => VoiceClip | null;
  seedanceClip: (videoId: string) => VoiceClip | null;
  refresh: () => Promise<void>;
};

const EMPTY_CLIPS: VoiceClip[] = [];
const BriefVoiceContext = createContext<BriefVoiceContextValue | null>(null);

function notifyVoice(kind: "success" | "error", message: string) {
  const text = message.replace(/\s+/g, " ").trim();
  if (!text) return;
  toast[kind](text, {
    position: "top-center",
    duration: kind === "error" ? 3600 : 2200,
    className: "!px-3 !py-2 !text-[13px] !leading-5 !shadow-md",
    style: { marginTop: "max(0px, env(safe-area-inset-top, 0px))" },
  });
}

export function useBriefVoice() {
  return useContext(BriefVoiceContext);
}

function publicUrl(path: string) {
  return supabase.storage.from(BRIEF_STORYBOARD_IMAGES_BUCKET).getPublicUrl(path).data.publicUrl;
}

export function BriefVoiceProvider({
  planId,
  canGenerate,
  children,
}: {
  planId?: string;
  canGenerate: boolean;
  children: ReactNode;
}) {
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const settingsQuery = useQuery({
    queryKey: ["voice-ai-config", organizationId],
    enabled: Boolean(organizationId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_voice_ai_config")
        .select("api_key_configured, voice_id, voice_name, tts_model, language_code, stability, similarity_boost, speed, auto_tag")
        .eq("organization_id", organizationId as string)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as VoiceSettings | null;
    },
  });
  const clipsQuery = useQuery({
    queryKey: ["brief-voice-clips", planId],
    enabled: Boolean(planId),
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brief_voice_clips")
        .select("id, kind, row_index, video_id, storage_path, file_name, spoken_text, created_at")
        .eq("social_media_plan_id", planId as string)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as Omit<VoiceClip, "url">[]).map((clip) => ({ ...clip, url: publicUrl(clip.storage_path) }));
    },
  });
  const clips = clipsQuery.data ?? EMPTY_CLIPS;
  const value = useMemo<BriefVoiceContextValue>(() => ({
    planId,
    canGenerate,
    settings: settingsQuery.data ?? null,
    voClip: (rowIndex, narration) =>
      clipForNarration(
        clips.filter((clip) => clip.kind === "vo" && clip.row_index === rowIndex),
        narration,
      ),
    seedanceClip: (videoId) => clips.find((clip) => clip.kind === "seedance" && clip.video_id === videoId) ?? null,
    refresh: async () => {
      await queryClient.invalidateQueries({ queryKey: ["brief-voice-clips", planId] });
      await queryClient.invalidateQueries({ queryKey: ["content-ai-usage", planId] });
    },
  }), [canGenerate, settingsQuery.data, clips, queryClient, planId]);

  return <BriefVoiceContext.Provider value={value}>{children}</BriefVoiceContext.Provider>;
}

async function downloadFile(url: string, fileName: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("download");
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(objectUrl);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

function ClipPlayer({ clip }: { clip: VoiceClip }) {
  const { t } = useAppTranslation();
  return (
    <div className="mt-1">
      <div className="flex items-center gap-1">
      <audio key={clip.id} controls preload="metadata" src={clip.url} className="h-8 min-w-0 flex-1" />
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-7 w-7 shrink-0 p-0"
        title={t("voiceAi.cell.downloadVoice", "Download voice")}
        aria-label={t("voiceAi.cell.downloadVoice", "Download voice")}
        onClick={(event) => {
          event.stopPropagation();
          void downloadFile(clip.url, clip.file_name);
        }}
      >
        <Download className="h-3.5 w-3.5" />
      </Button>
      </div>
    </div>
  );
}

export function BriefDubbedVideo({ videoUrl, voiceUrl, videoName, framed = false }: { videoUrl: string; voiceUrl: string | null; videoName: string; framed?: boolean }) {
  const { t } = useAppTranslation();
  return (
    <div
      className={framed ? "relative w-full" : "mt-2"}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <video
        key={`${videoUrl}:${voiceUrl ?? ""}`}
        src={videoUrl}
        controls
        playsInline
        preload="metadata"
        muted={Boolean(voiceUrl)}
        className={framed ? "pointer-events-auto block w-full bg-black" : "w-full rounded-md bg-black"}
        onVolumeChange={(event) => {
          if (voiceUrl) event.currentTarget.muted = true;
        }}
        onEnded={(event) => {
          const audio = event.currentTarget.nextElementSibling;
          if (audio instanceof HTMLAudioElement) audio.pause();
        }}
        onPlay={(event) => {
          const audio = event.currentTarget.nextElementSibling;
          if (!(audio instanceof HTMLAudioElement)) return;
          audio.currentTime = event.currentTarget.currentTime;
          void audio.play().catch(() => undefined);
        }}
        onPause={(event) => {
          const audio = event.currentTarget.nextElementSibling;
          if (audio instanceof HTMLAudioElement) audio.pause();
        }}
        onSeeked={(event) => {
          const audio = event.currentTarget.nextElementSibling;
          if (audio instanceof HTMLAudioElement) audio.currentTime = event.currentTarget.currentTime;
        }}
      />
      {voiceUrl ? <audio src={voiceUrl} preload="none" /> : null}
      <div className={framed ? "absolute right-1.5 top-1.5 z-[3] flex gap-1" : "mt-1 flex justify-end gap-1"}>
        {voiceUrl ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={framed ? "h-6 w-6 rounded-full bg-black/55 p-0 text-white hover:bg-black/75 hover:text-white" : "h-7 px-2 text-[11px]"}
            title={t("voiceAi.cell.downloadVoice", "Download voice")}
            aria-label={t("voiceAi.cell.downloadVoice", "Download voice")}
            onClick={() => void downloadFile(voiceUrl, "organization-voice.mp3")}
          >
            {framed ? <Download className="h-3.5 w-3.5" /> : t("voiceAi.cell.downloadVoice", "Download voice")}
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className={framed ? "h-6 w-6 rounded-full bg-black/55 p-0 text-white hover:bg-black/75 hover:text-white" : "h-7 px-2 text-[11px]"}
          title={t("voiceAi.cell.downloadVideo", "Download original video")}
          aria-label={t("voiceAi.cell.downloadVideo", "Download original video")}
          onClick={() => void downloadFile(videoUrl, videoName)}
        >
          {framed ? <Download className="h-3.5 w-3.5" /> : t("voiceAi.cell.downloadVideo", "Download original video")}
        </Button>
      </div>
    </div>
  );
}

export function BriefVideoPlayback({ rowIndex }: { rowIndex: number }) {
  const video = useBriefVideo();
  const voice = useBriefVoice();
  const status = video?.statusFor(rowIndex);
  if (!status?.url) return null;
  const voiceUrl = status.videoId ? voice?.seedanceClip(status.videoId)?.url ?? null : null;
  return <BriefDubbedVideo videoUrl={status.url} voiceUrl={voiceUrl} videoName={`seedance-${rowIndex + 1}.mp4`} />;
}

function VoiceDialog({
  open,
  mode,
  text,
  videoId,
  rowIndex,
  onChangeText,
  onClose,
}: {
  open: boolean;
  mode: "vo" | "seedance";
  text: string;
  videoId?: string;
  rowIndex: number;
  onChangeText?: (next: string) => void;
  onClose: () => void;
}) {
  const { t } = useAppTranslation();
  const isMobile = useIsMobile();
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const voice = useBriefVoice();
  const [pending, setPending] = useState<null | "save" | "generate">(null);
  const [stability, setStability] = useState(0.5);
  const [similarity, setSimilarity] = useState(0.75);
  const [autoTag, setAutoTag] = useState(true);
  const settings = voice?.settings ?? null;
  const ready = Boolean(settings?.api_key_configured && settings.voice_id);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const node = anchorRef.current;
    const next = node?.closest("[data-vaul-drawer], [role='dialog']");
    setHost(next instanceof HTMLElement ? next : document.body);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, pending, onClose]);
  useEffect(() => {
    if (!open) return;
    setStability(Number(settings?.stability ?? 0.5));
    setSimilarity(Number(settings?.similarity_boost ?? 0.75));
    setAutoTag(settings?.auto_tag !== false && voiceModelSupportsAudioTags(settings?.tts_model ?? ""));
  }, [open, settings?.stability, settings?.similarity_boost, settings?.tts_model, settings?.auto_tag]);
  const supportsTags = voiceModelSupportsAudioTags(settings?.tts_model ?? "");
  const readTone = () => {
    const nextStability = Math.min(1, Math.max(0, Number.isFinite(stability) ? stability : 0.5));
    const nextSimilarity = Math.min(1, Math.max(0, Number.isFinite(similarity) ? similarity : 0.75));
    const nextAutoTag = supportsTags && autoTag;
    return { nextStability, nextSimilarity, nextAutoTag };
  };
  const saveTone = async () => {
    if (!organizationId) throw new Error(t("voiceAi.confirm.toneSaveFailed", "The voice tone could not be saved."));
    const tone = readTone();
    const { data: savedTone, error: toneError } = await supabase
      .from("organization_voice_ai_config")
      .update({ stability: tone.nextStability, similarity_boost: tone.nextSimilarity, auto_tag: tone.nextAutoTag })
      .eq("organization_id", organizationId)
      .select("stability, similarity_boost, auto_tag")
      .maybeSingle();
    if (toneError) throw toneError;
    if (!savedTone) throw new Error(t("voiceAi.confirm.toneSaveFailed", "The voice tone could not be saved."));
    queryClient.setQueryData(["voice-ai-config", organizationId], (current: VoiceSettings | null | undefined) => (
      current ? { ...current, stability: tone.nextStability, similarity_boost: tone.nextSimilarity, auto_tag: tone.nextAutoTag } : current
    ));
    return tone;
  };
  const confirm = async () => {
    if (!ready || pending) return;
    setPending(mode === "vo" ? "save" : "generate");
    try {
      if (mode === "vo") {
        await saveTone();
        await queryClient.invalidateQueries({ queryKey: ["voice-ai-config", organizationId] });
        notifyVoice("success", t("voiceAi.settings.saved", "Voice configuration saved"));
        onClose();
        return;
      }
      const { data, error } = await supabase.functions.invoke("generate-brief-voice", { body: { action: "sts", videoId } });
      const message = await readEdgeFunctionError(data, error);
      if (message && !data?.clip) {
        notifyVoice("error", message);
        return;
      }
      await voice?.refresh();
      notifyVoice("success", t("voiceAi.confirm.started", "Voice is ready."));
      onClose();
    } catch (error) {
      notifyVoice("error", error instanceof Error ? error.message : t("voiceAi.settings.saveFailed", "Could not save the voice configuration"));
    } finally {
      setPending(null);
    }
  };

  const sheet = open && host ? (
    <div
      className={cn(
        "pointer-events-auto z-[80] flex",
        isMobile ? "flex-col justify-end" : "items-center justify-center p-4",
        host === document.body ? "fixed inset-0" : "absolute inset-0",
      )}
      data-vaul-no-drag=""
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label={t("voiceAi.settings.cancel", "Cancel")}
        disabled={pending != null}
        onClick={() => { if (!pending) onClose(); }}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative z-10 flex max-h-[min(85dvh,40rem)] w-full flex-col overflow-hidden border bg-background shadow-lg",
          isMobile ? "rounded-t-xl" : "max-w-[min(32rem,88vmin)]",
        )}
        data-vaul-no-drag=""
      >
        <div className="shrink-0 px-4 pb-2 pt-4 text-left">
          <h2 className="text-lg font-semibold leading-none tracking-tight">
            {mode === "vo"
              ? t("voiceAi.cell.settings", "Settings")
              : t("voiceAi.confirm.videoTitle", "Match the video voice")}
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {ready
              ? mode === "vo"
                ? t("voiceAi.confirm.settingsBody", "These settings are used the next time you generate VO from the scene.")
                : t("voiceAi.confirm.videoBody", "The spoken audio from this Seedance video is sent to the organization voice. Pauses stay with the mouth movement. The original video file is kept.")
              : t("voiceAi.confirm.missing", "Save an ElevenLabs API key and Voice ID in Settings > Voice AI first.")}
          </p>
        </div>
        {ready ? (
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 text-sm [touch-action:pan-y]" data-vaul-no-drag="">
            <p><span className="text-muted-foreground">{t("voiceAi.confirm.voice", "Voice")}: </span>{settings?.voice_name || settings?.voice_id}</p>
            <p><span className="text-muted-foreground">{t("voiceAi.settings.model", "Model")}: </span>{voiceModelLabel(settings?.tts_model ?? "")}</p>
            {mode === "vo" && voiceModelUsesLanguage(settings?.tts_model ?? "") ? (
              <p>
                <span className="text-muted-foreground">{t("voiceAi.settings.language", "Language")}: </span>
                {t(`voiceAi.language.${settings?.language_code || "id"}`, VOICE_LANGUAGES.find((item) => item.id === settings?.language_code)?.fallback ?? settings?.language_code ?? "Indonesian")}
              </p>
            ) : null}
            {mode === "vo" && supportsTags ? (
              <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{t("voiceAi.confirm.autoTag", "Auto-tag")}</p>
                  <p className="text-[11px] text-muted-foreground">{t("voiceAi.confirm.autoTagHelp", "Generating VO from the scene adds the expression to this line, then creates the audio.")}</p>
                </div>
                <Switch checked={autoTag} disabled={pending != null} onCheckedChange={setAutoTag} aria-label={t("voiceAi.confirm.autoTag", "Auto-tag")} />
              </div>
            ) : null}
            {mode === "vo" ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="brief-voice-stability">{t("voiceAi.settings.stability", "Stability")}</Label>
                    <span className="text-xs text-muted-foreground">{stability.toFixed(2)}</span>
                  </div>
                  <Slider id="brief-voice-stability" min={0} max={1} step={0.05} value={[stability]} disabled={pending != null} onValueChange={(value) => setStability(value[0] ?? 0.5)} />
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>{t("voiceAi.confirm.stabilityLow", "Creative · 0")}</span>
                    <span>{t("voiceAi.confirm.stabilityHigh", "Robust · 1")}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="brief-voice-similarity">{t("voiceAi.settings.similarity", "Similarity")}</Label>
                    <span className="text-xs text-muted-foreground">{similarity.toFixed(2)}</span>
                  </div>
                  <Slider id="brief-voice-similarity" min={0} max={1} step={0.05} value={[similarity]} disabled={pending != null} onValueChange={(value) => setSimilarity(value[0] ?? 0.75)} />
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>{t("voiceAi.confirm.similarityLow", "Low · 0")}</span>
                    <span>{t("voiceAi.confirm.similarityHigh", "High · 1")}</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t("voiceAi.settings.stability", "Stability")} {settings?.stability} · {t("voiceAi.settings.similarity", "Similarity")} {settings?.similarity_boost}
                {voiceModelUsesSpeed(settings?.tts_model ?? "") ? ` · ${t("voiceAi.settings.speed", "Speed")} ${settings?.speed}` : ""}
              </p>
            )}
          </div>
        ) : null}
        <div className={cn(
          "mt-auto flex shrink-0 gap-2 px-4 pt-2",
          isMobile ? "flex-col pb-[max(1rem,env(safe-area-inset-bottom))]" : "flex-row justify-end pb-4",
        )}>
          {!isMobile ? (
            <Button type="button" variant="outline" className="order-1" disabled={pending != null} onClick={onClose}>{t("voiceAi.settings.cancel", "Cancel")}</Button>
          ) : null}
          {mode === "vo" ? (
            <Button type="button" variant="outline" className={isMobile ? "order-1" : "order-2"} disabled={!ready || pending != null} onClick={() => void confirm()}>
              {pending === "save" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {pending === "save" ? t("voiceAi.settings.saving", "Saving...") : t("voiceAi.settings.save", "Save")}
            </Button>
          ) : (
            <Button
              type="button"
              className={isMobile ? "order-1" : "order-3"}
              disabled={!ready || pending != null || !videoId}
              onClick={() => void confirm()}
            >
              {pending === "generate" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {pending === "generate"
                ? t("voiceAi.confirm.generating", "Generating...")
                : t("voiceAi.confirm.generate", "Generate")}
            </Button>
          )}
          {isMobile ? (
            <Button type="button" variant="outline" className="order-3" disabled={pending != null} onClick={onClose}>{t("voiceAi.settings.cancel", "Cancel")}</Button>
          ) : null}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <span ref={anchorRef} hidden />
      {sheet && host ? createPortal(sheet, host) : null}
    </>
  );
}

export function BriefNarrationPlay({
  rowIndex,
  slides,
  activeIndex,
  onSelect,
}: {
  rowIndex: number;
  slides: string[];
  activeIndex: number;
  onSelect?: (index: number) => void;
}) {
  const { t } = useAppTranslation();
  const voice = useBriefVoice();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const text = slides[activeIndex] ?? "";
  const clip = voice && text.trim() ? voice.voClip(rowIndex, text) : null;

  useEffect(() => {
    setPlaying(false);
  }, [clip?.id]);

  if (!voice || slides.length === 0) return null;

  const versionLabel = (index: number) =>
    index <= 0
      ? t("briefDialog.version.original", "Original")
      : t("briefDialog.version.numbered", "V.{{index}}", { index });
  const toggle = () => {
    const audio = audioRef.current;
    if (!audio || !clip) return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    document.querySelectorAll("audio[data-storyboard-narration]").forEach((node) => {
      if (node !== audio && node instanceof HTMLAudioElement) node.pause();
    });
    void audio.play().catch(() => setPlaying(false));
  };

  return (
    <div
      className="flex shrink-0 items-center"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        disabled={!clip}
        aria-pressed={playing}
        aria-label={playing
          ? t("briefDialog.layout.pauseNarration", "Pause narration")
          : t("briefDialog.layout.playNarration", "Play narration")}
        title={clip
          ? (playing
            ? t("briefDialog.layout.pauseNarration", "Pause narration")
            : t("briefDialog.layout.playNarration", "Play narration"))
          : t("briefDialog.layout.narrationMissing", "No ElevenLabs audio for this version yet.")}
        onClick={toggle}
        className="flex h-6 w-6 items-center justify-center rounded text-gray-500 hover:bg-gray-200/80 hover:text-gray-800 disabled:opacity-30"
      >
        {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      </button>
      {slides.length > 1 ? (
        <div className="relative">
          <select
            aria-label={t("briefDialog.layout.narrationVersion", "Narration version")}
            value={activeIndex}
            onChange={(event) => onSelect?.(Number(event.target.value))}
            className="h-6 cursor-pointer appearance-none bg-transparent py-0 pl-0.5 pr-3.5 text-[11px] font-medium text-gray-500 hover:text-gray-800 focus:outline-none"
          >
            {slides.map((_, index) => (
              <option key={index} value={index}>{versionLabel(index)}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-0 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" aria-hidden />
        </div>
      ) : null}
      {clip ? (
        <audio
          key={clip.id}
          ref={audioRef}
          data-storyboard-narration=""
          src={clip.url}
          preload="none"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
        />
      ) : null}
    </div>
  );
}

export function BriefVoiceOverActions({
  rowIndex,
  text,
  onChangeText,
}: {
  rowIndex: number;
  text: string;
  onChangeText?: (next: string) => void;
}) {
  const { t } = useAppTranslation();
  const voice = useBriefVoice();
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  if (!voice) return null;
  const clip = voice.voClip(rowIndex, text);
  const hasText = text.trim().length > 0;
  if (!clip && !(voice.canGenerate && hasText)) return null;

  const generateVo = async () => {
    if (generating || !voice.canGenerate || !voice.planId || !text.trim()) return;
    const settings = voice.settings;
    if (!settings?.api_key_configured || !settings.voice_id) {
      notifyVoice("error", t("voiceAi.confirm.missing", "Save an ElevenLabs API key and Voice ID in Settings > Voice AI first."));
      return;
    }
    setGenerating(true);
    try {
      const speak = async (spoken: string) => {
        const result = await supabase.functions.invoke("generate-brief-voice", {
          body: {
            action: "tts",
            planId: voice.planId,
            rowIndex,
            text: spoken,
          },
        });
        return { data: result.data, message: await readEdgeFunctionError(result.data, result.error) };
      };
      let spoken = text;
      let { data, message } = await speak(spoken);
      const geminiBlocked = Boolean(message) && !data?.clip && (isGeminiSpendCapMessage(message) || /gemini/i.test(message));
      if (geminiBlocked && !/\[[^\]\n]{1,40}\]/.test(text)) {
        spoken = `[conversational] ${text.trim()}`;
        ({ data, message } = await speak(spoken));
      }
      if (message && !data?.clip) {
        notifyVoice(
          "error",
          isGeminiSpendCapMessage(message) || /gemini/i.test(message)
            ? t("voiceAi.confirm.elevenLabsFailed", "Voice could not be created with ElevenLabs.")
            : message,
        );
        return;
      }
      await voice.refresh();
      notifyVoice("success", t("voiceAi.confirm.started", "Voice is ready."));
    } catch (error) {
      notifyVoice("error", error instanceof Error ? error.message : t("voiceAi.settings.saveFailed", "Could not save the voice configuration"));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="mt-1" onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
      {clip ? <ClipPlayer clip={clip} /> : null}
      {voice.canGenerate && hasText ? (
        <div className="mt-1 flex flex-wrap gap-1">
          <Button type="button" variant="outline" size="sm" className="h-7 gap-1 px-2 text-[11px]" onClick={() => setOpen(true)}>
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {t("voiceAi.cell.settings", "Settings")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 px-2 text-[11px]"
            title={t("voiceAi.cell.generate", "Generate VO")}
            disabled={generating}
            onClick={() => void generateVo()}
          >
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <AudioLines className="h-3.5 w-3.5" />}
            {generating
              ? t("voiceAi.confirm.generating", "Generating...")
              : t("voiceAi.cell.generate", "Generate VO")}
          </Button>
        </div>
      ) : null}
      <VoiceDialog open={open} mode="vo" text={text} rowIndex={rowIndex} onChangeText={onChangeText} onClose={() => setOpen(false)} />
    </div>
  );
}

export function BriefSeedanceVoiceButton({ rowIndex, scope }: { rowIndex: number; scope: "shot" | "master" }) {
  const { t } = useAppTranslation();
  const voice = useBriefVoice();
  const video = useBriefVideo();
  const [open, setOpen] = useState(false);
  const videoId = video?.readyVoiceVideo(rowIndex, scope) ?? null;
  const shownId = video?.statusFor(rowIndex).videoId ?? null;
  if (!voice?.canGenerate || !videoId || videoId !== shownId) return null;
  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-7 w-7 shrink-0 bg-white p-0"
        title={t("voiceAi.cell.restyle", "Use organization voice")}
        aria-label={t("voiceAi.cell.restyle", "Use organization voice")}
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
      >
        <AudioLines className="h-3.5 w-3.5" />
      </Button>
      <VoiceDialog open={open} mode="seedance" text="" videoId={videoId} rowIndex={rowIndex} onClose={() => setOpen(false)} />
    </>
  );
}
