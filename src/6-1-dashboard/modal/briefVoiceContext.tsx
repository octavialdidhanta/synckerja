import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AudioLines, ChevronDown, Download, Loader2, Pause, Play, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { Slider } from "@/shared/components/ui/slider";
import { Switch } from "@/shared/components/ui/switch";
import { hasVoiceExpression, narrationWithoutTags, voiceModelSupportsAudioTags } from "../../../supabase/functions/_shared/voiceAudioTags.ts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { supabase } from "@/shared/lib/supabaseClient";
import { readEdgeFunctionError } from "@/shared/ai/geminiSpendCap";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
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
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const voice = useBriefVoice();
  const [pending, setPending] = useState(false);
  const [stability, setStability] = useState(0.5);
  const [similarity, setSimilarity] = useState(0.75);
  const [autoTag, setAutoTag] = useState(true);
  const settings = voice?.settings ?? null;
  const ready = Boolean(settings?.api_key_configured && settings.voice_id);
  useEffect(() => {
    if (!open) return;
    setStability(Number(settings?.stability ?? 0.5));
    setSimilarity(Number(settings?.similarity_boost ?? 0.75));
    setAutoTag(settings?.auto_tag !== false && voiceModelSupportsAudioTags(settings?.tts_model ?? ""));
  }, [open, settings?.stability, settings?.similarity_boost, settings?.tts_model, settings?.auto_tag]);
  const confirm = async () => {
    if (!ready || pending) return;
    setPending(true);
    try {
      if (mode === "vo") {
        if (!organizationId) return;
        const nextStability = Math.min(1, Math.max(0, Number.isFinite(stability) ? stability : 0.5));
        const nextSimilarity = Math.min(1, Math.max(0, Number.isFinite(similarity) ? similarity : 0.75));
        const nextAutoTag = voiceModelSupportsAudioTags(settings?.tts_model ?? "") && autoTag;
        const { data: savedTone, error: toneError } = await supabase
          .from("organization_voice_ai_config")
          .update({ stability: nextStability, similarity_boost: nextSimilarity, auto_tag: nextAutoTag })
          .eq("organization_id", organizationId)
          .select("stability, similarity_boost, auto_tag")
          .maybeSingle();
        if (toneError) throw toneError;
        if (!savedTone) throw new Error(t("voiceAi.confirm.toneSaveFailed", "The voice tone could not be saved."));
        queryClient.setQueryData(["voice-ai-config", organizationId], (current: VoiceSettings | null | undefined) => (
          current ? { ...current, stability: nextStability, similarity_boost: nextSimilarity, auto_tag: nextAutoTag } : current
        ));
        if (nextAutoTag && voiceModelSupportsAudioTags(settings?.tts_model ?? "") && text.trim()) {
          const { data, error } = await supabase.functions.invoke("generate-brief-voice", {
            body: { action: "tag", planId: voice?.planId, rowIndex, text: narrationWithoutTags(text) },
          });
          const message = await readEdgeFunctionError(data, error);
          const tagged = String(data?.text ?? "").trim();
          if (message && !hasVoiceExpression(tagged)) {
            toast.error(message);
            return;
          }
          if (!hasVoiceExpression(tagged)) throw new Error(t("voiceAi.confirm.expressionFailed", "The expression could not be added."));
          onChangeText?.(tagged);
        } else if (hasVoiceExpression(text)) {
          onChangeText?.(narrationWithoutTags(text));
        }
        await queryClient.invalidateQueries({ queryKey: ["voice-ai-config", organizationId] });
        toast.success(t("voiceAi.settings.saved", "Voice configuration saved"));
        onClose();
        return;
      }
      const { data, error } = await supabase.functions.invoke("generate-brief-voice", { body: { action: "sts", videoId } });
      const message = await readEdgeFunctionError(data, error);
      if (message && !data?.clip) {
        toast.error(message);
        return;
      }
      await voice?.refresh();
      toast.success(t("voiceAi.confirm.started", "Voice is ready."));
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("voiceAi.settings.saveFailed", "Could not save the voice configuration"));
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !pending) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "vo"
              ? t("voiceAi.cell.settings", "Settings")
              : t("voiceAi.confirm.videoTitle", "Match the video voice")}
          </DialogTitle>
          <DialogDescription>
            {ready
              ? mode === "vo"
                ? t("voiceAi.confirm.settingsBody", "Save these settings first. Generate VO uses the saved stability, similarity, and auto-tag.")
                : t("voiceAi.confirm.videoBody", "The spoken audio from this Seedance video is sent to the organization voice. Pauses stay with the mouth movement. The original video file is kept.")
              : t("voiceAi.confirm.missing", "Save an ElevenLabs API key and Voice ID in Settings > Voice AI first.")}
          </DialogDescription>
        </DialogHeader>
        {ready ? (
          <div className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">{t("voiceAi.confirm.voice", "Voice")}: </span>{settings?.voice_name || settings?.voice_id}</p>
            <p><span className="text-muted-foreground">{t("voiceAi.settings.model", "Model")}: </span>{voiceModelLabel(settings?.tts_model ?? "")}</p>
            {mode === "vo" && voiceModelUsesLanguage(settings?.tts_model ?? "") ? (
              <p>
                <span className="text-muted-foreground">{t("voiceAi.settings.language", "Language")}: </span>
                {t(`voiceAi.language.${settings?.language_code || "id"}`, VOICE_LANGUAGES.find((item) => item.id === settings?.language_code)?.fallback ?? settings?.language_code ?? "Indonesian")}
              </p>
            ) : null}
            {mode === "vo" && voiceModelSupportsAudioTags(settings?.tts_model ?? "") ? (
              <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{t("voiceAi.confirm.autoTag", "Auto-tag")}</p>
                  <p className="text-[11px] text-muted-foreground">{t("voiceAi.confirm.autoTagHelp", "Saving puts the expression on this VO line. Generate stays off until that expression is visible.")}</p>
                </div>
                <Switch checked={autoTag} disabled={pending} onCheckedChange={setAutoTag} aria-label={t("voiceAi.confirm.autoTag", "Auto-tag")} />
              </div>
            ) : null}
            {mode === "vo" ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="brief-voice-stability">{t("voiceAi.settings.stability", "Stability")}</Label>
                    <span className="text-xs text-muted-foreground">{stability.toFixed(2)}</span>
                  </div>
                  <Slider id="brief-voice-stability" min={0} max={1} step={0.05} value={[stability]} disabled={pending} onValueChange={(value) => setStability(value[0] ?? 0.5)} />
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
                  <Slider id="brief-voice-similarity" min={0} max={1} step={0.05} value={[similarity]} disabled={pending} onValueChange={(value) => setSimilarity(value[0] ?? 0.75)} />
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
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={onClose}>{t("voiceAi.settings.cancel", "Cancel")}</Button>
          <Button type="button" disabled={!ready || pending || (mode === "seedance" && !videoId)} onClick={() => void confirm()}>
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {pending
              ? (mode === "vo" ? t("voiceAi.settings.saving", "Saving...") : t("voiceAi.confirm.generating", "Generating..."))
              : (mode === "vo" ? t("voiceAi.settings.save", "Save") : t("voiceAi.confirm.generate", "Generate"))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  const expressionRequired = voice.settings?.auto_tag !== false && voiceModelSupportsAudioTags(voice.settings?.tts_model ?? "");
  const expressionReady = !expressionRequired || hasVoiceExpression(text);
  const generate = async () => {
    if (!voice.canGenerate || !hasText || !expressionReady || generating || !voice.planId) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-brief-voice", {
        body: {
          action: "tts",
          planId: voice.planId,
          rowIndex,
          text,
          autoTag: false,
        },
      });
      const message = await readEdgeFunctionError(data, error);
      if (message && !data?.clip) {
        toast.error(message);
        return;
      }
      await voice.refresh();
      toast.success(t("voiceAi.confirm.started", "Voice is ready."));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("voiceAi.settings.saveFailed", "Could not save the voice configuration"));
    } finally {
      setGenerating(false);
    }
  };
  if (!clip && !(voice.canGenerate && hasText)) return null;
  return (
    <div className="mt-1" onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
      {clip ? <ClipPlayer clip={clip} /> : null}
      {voice.canGenerate && hasText ? (
        <div className="mt-1 flex flex-wrap gap-1">
          <Button type="button" variant="outline" size="sm" className="h-7 gap-1 px-2 text-[11px]" disabled={generating} onClick={() => setOpen(true)}>
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {t("voiceAi.cell.settings", "Settings")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 px-2 text-[11px]"
            disabled={generating || !expressionReady}
            title={expressionReady ? t("voiceAi.cell.generate", "Generate VO") : t("voiceAi.cell.waitingExpression", "Save settings so the expression appears on this line")}
            onClick={() => void generate()}
          >
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <AudioLines className="h-3.5 w-3.5" />}
            {generating ? t("voiceAi.confirm.generating", "Generating...") : t("voiceAi.cell.generate", "Generate VO")}
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
