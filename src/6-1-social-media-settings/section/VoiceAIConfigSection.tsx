import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Slider } from "@/shared/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { supabase } from "@/shared/lib/supabaseClient";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { readEdgeFunctionError } from "@/shared/ai/geminiSpendCap";
import { VOICE_LANGUAGES, VOICE_TTS_MODELS, voiceModelUsesLanguage, voiceModelUsesSpeed } from "@/6-1-dashboard/lib/voiceModels";
import { toast } from "sonner";

type VoiceAIConfigRow = {
  id: string;
  organization_id: string;
  api_key_configured: boolean;
  voice_id: string | null;
  voice_name: string | null;
  tts_model: string;
  language_code: string;
  stability: number;
  similarity_boost: number;
  speed: number;
  daily_limit: number;
};

const CONFIG_SELECT =
  "id, organization_id, api_key_configured, voice_id, voice_name, tts_model, language_code, stability, similarity_boost, speed, daily_limit";

function clamp(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

export const VoiceAIConfigSection: React.FC = () => {
  const { t } = useAppTranslation();
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const { data: configRow, isPending } = useQuery({
    queryKey: ["voice-ai-config", organizationId],
    enabled: Boolean(organizationId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_voice_ai_config")
        .select(CONFIG_SELECT)
        .eq("organization_id", organizationId as string)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as VoiceAIConfigRow | null;
    },
  });
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [model, setModel] = useState("eleven_v4");
  const [language, setLanguage] = useState("id");
  const [stability, setStability] = useState(0.5);
  const [similarity, setSimilarity] = useState(0.75);
  const [speed, setSpeed] = useState(1);
  const [dailyLimit, setDailyLimit] = useState(50);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [appliedKey, setAppliedKey] = useState("");
  const [editing, setEditing] = useState(false);

  const serverKey = configRow
    ? `${configRow.id}:${configRow.voice_id}:${configRow.tts_model}:${configRow.language_code}:${configRow.stability}:${configRow.similarity_boost}:${configRow.speed}:${configRow.daily_limit}:${configRow.api_key_configured}`
    : "";
  if (serverKey !== appliedKey && !apiKeyInput.trim() && !editing) {
    setAppliedKey(serverKey);
    setVoiceId(configRow?.voice_id ?? "");
    setModel(configRow?.tts_model || "eleven_v4");
    setLanguage(configRow?.language_code || "id");
    setStability(Number(configRow?.stability ?? 0.5));
    setSimilarity(Number(configRow?.similarity_boost ?? 0.75));
    setSpeed(Number(configRow?.speed ?? 1));
    setDailyLimit(configRow?.daily_limit ?? 50);
  }

  const nextStability = clamp(stability, 0, 1, 0.5);
  const nextSimilarity = clamp(similarity, 0, 1, 0.75);
  const nextSpeed = clamp(speed, 0.7, 1.2, 1);
  const nextLimit = Math.max(1, Number(dailyLimit) || 50);
  const isDirty = !configRow
    || apiKeyInput.trim().length > 0
    || voiceId.trim() !== (configRow.voice_id ?? "")
    || model !== configRow.tts_model
    || language !== (configRow.language_code || "id")
    || nextStability !== Number(configRow.stability)
    || nextSimilarity !== Number(configRow.similarity_boost)
    || nextSpeed !== Number(configRow.speed)
    || nextLimit !== Number(configRow.daily_limit);

  const save = async () => {
    if (!organizationId) return;
    if (!configRow?.api_key_configured && !apiKeyInput.trim()) {
      toast.error(t("voiceAi.settings.keyRequired", "An ElevenLabs API key is required."));
      return;
    }
    if (!voiceId.trim()) {
      toast.error(t("voiceAi.settings.voiceRequired", "A Voice ID is required."));
      return;
    }
    setIsSaving(true);
    try {
      const payload: Record<string, unknown> = {
        voice_id: voiceId.trim(),
        tts_model: model,
        language_code: language,
        stability: nextStability,
        similarity_boost: nextSimilarity,
        speed: nextSpeed,
        daily_limit: nextLimit,
      };
      if (apiKeyInput.trim()) {
        payload.elevenlabs_api_key = apiKeyInput.trim();
        payload.api_key_configured = true;
      }
      const query = configRow?.id
        ? supabase.from("organization_voice_ai_config").update(payload).eq("id", configRow.id)
        : supabase.from("organization_voice_ai_config").insert({
            ...payload,
            organization_id: organizationId,
            api_key_configured: true,
          });
      const { error } = await query;
      if (error) throw error;
      setApiKeyInput("");
      setEditing(false);
      const { data, error: describeError } = await supabase.functions.invoke("generate-brief-voice", { body: { action: "describe" } });
      const message = await readEdgeFunctionError(data, describeError);
      await queryClient.invalidateQueries({ queryKey: ["voice-ai-config", organizationId] });
      if (message && !data?.voiceName) {
        toast.error(message);
        return;
      }
      toast.success(t("voiceAi.settings.saved", "Voice configuration saved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("voiceAi.settings.saveFailed", "Could not save the voice configuration"));
    } finally {
      setIsSaving(false);
    }
  };

  const cancel = () => {
    setApiKeyInput("");
    setVoiceId(configRow?.voice_id ?? "");
    setModel(configRow?.tts_model || "eleven_v4");
    setLanguage(configRow?.language_code || "id");
    setStability(Number(configRow?.stability ?? 0.5));
    setSimilarity(Number(configRow?.similarity_boost ?? 0.75));
    setSpeed(Number(configRow?.speed ?? 1));
    setDailyLimit(configRow?.daily_limit ?? 50);
    setEditing(false);
  };

  const removeKey = async () => {
    if (!configRow?.id) return;
    setIsRemoving(true);
    try {
      const { error } = await supabase
        .from("organization_voice_ai_config")
        .update({ elevenlabs_api_key: null, api_key_configured: false, voice_name: null })
        .eq("id", configRow.id);
      if (error) throw error;
      setConfirmRemove(false);
      await queryClient.invalidateQueries({ queryKey: ["voice-ai-config", organizationId] });
      toast.success(t("voiceAi.settings.keyRemoved", "API key removed"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("voiceAi.settings.removeFailed", "Could not remove the API key"));
    } finally {
      setIsRemoving(false);
    }
  };

  if (!organizationId || isPending) return null;

  const locked = Boolean(configRow) && !editing;

  return (
    <div className="max-w-xl space-y-6">
      <div className="space-y-2">
        <Label htmlFor="voice-ai-key">{t("voiceAi.settings.key", "ElevenLabs API Key")}</Label>
        <div className="flex items-center gap-2">
          <Input
            id="voice-ai-key"
            type="password"
            autoComplete="off"
            value={apiKeyInput}
            disabled={locked}
            onChange={(event) => setApiKeyInput(event.target.value)}
            placeholder={
              configRow?.api_key_configured
                ? t("voiceAi.settings.keySet", "•••••••••••• API key is already configured")
                : t("voiceAi.settings.keyEmpty", "Paste the API key from ElevenLabs")
            }
          />
          {configRow?.api_key_configured && !locked ? (
            <Button type="button" variant="outline" className="shrink-0 text-destructive" onClick={() => setConfirmRemove(true)}>
              <Trash2 className="mr-1 h-4 w-4" />
              {t("voiceAi.settings.remove", "Remove")}
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          {t("voiceAi.settings.keyHelp", "This key belongs to the active organization only. The key is not shown after it is saved.")}{" "}
          <a className="inline-flex items-center gap-1 text-primary underline" href="https://elevenlabs.io/app/settings/api-keys" target="_blank" rel="noreferrer">
            {t("voiceAi.settings.createKey", "Create key")}
            <ExternalLink className="h-3 w-3" />
          </a>
        </p>
        <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
          <p className="text-xs font-medium text-foreground">
            {t("voiceAi.settings.keyChecklistTitle", "When creating the key in ElevenLabs")}
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
            <li>{t("voiceAi.settings.keyChecklist.restrict", "Turn Restrict Key on.")}</li>
            <li>{t("voiceAi.settings.keyChecklist.tts", "Text to Speech: Access")}</li>
            <li>{t("voiceAi.settings.keyChecklist.sts", "Speech to Speech: Access")}</li>
            <li>{t("voiceAi.settings.keyChecklist.voices", "Voices: Read")}</li>
            <li>{t("voiceAi.settings.keyChecklist.ip", "Restrict by IP address: off")}</li>
            <li>{t("voiceAi.settings.keyChecklist.leak", "Auto-disable if leaked: on")}</li>
            <li>{t("voiceAi.settings.keyChecklist.rest", "Leave every other permission on No Access.")}</li>
          </ul>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="voice-ai-id">{t("voiceAi.settings.voiceId", "Voice ID")}</Label>
        <Input id="voice-ai-id" value={voiceId} disabled={locked} onChange={(event) => setVoiceId(event.target.value)} placeholder="21m00Tcm4TlvDq8ikWAM" />
        <p className="text-xs text-muted-foreground">
          {configRow?.voice_name
            ? t("voiceAi.settings.voiceName", "Saved voice: {{name}}", { name: configRow.voice_name })
            : t("voiceAi.settings.voiceHelp", "One voice for every narration in this organization.")}{" "}
          <a className="inline-flex items-center gap-1 text-primary underline" href="https://elevenlabs.io/app/voice-library" target="_blank" rel="noreferrer">
            {t("voiceAi.settings.voiceLibrary", "Voice library")}
            <ExternalLink className="h-3 w-3" />
          </a>
        </p>
      </div>
      <div className="space-y-2">
        <Label>{t("voiceAi.settings.model", "Model")}</Label>
        <Select value={model} onValueChange={setModel} disabled={locked}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {(VOICE_TTS_MODELS.some((item) => item.id === model) ? VOICE_TTS_MODELS : [...VOICE_TTS_MODELS, { id: model, label: model }]).map((item) => (
              <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {voiceModelUsesLanguage(model) ? null : (
          <p className="text-xs text-muted-foreground">{t("voiceAi.settings.languageIgnored", "This model detects the language from the narration text.")}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label>{t("voiceAi.settings.language", "Language")}</Label>
        <Select value={language} onValueChange={setLanguage} disabled={locked}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {VOICE_LANGUAGES.map((item) => (
              <SelectItem key={item.id} value={item.id}>{t(`voiceAi.language.${item.id}`, item.fallback)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="voice-ai-stability">{t("voiceAi.settings.stability", "Stability")}</Label>
            <span className="text-xs text-muted-foreground">{stability.toFixed(2)}</span>
          </div>
          <Slider id="voice-ai-stability" min={0} max={1} step={0.05} value={[stability]} disabled={locked} onValueChange={(value) => setStability(value[0] ?? 0.5)} />
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>{t("voiceAi.confirm.stabilityLow", "Creative · 0")}</span>
            <span>{t("voiceAi.confirm.stabilityHigh", "Robust · 1")}</span>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="voice-ai-similarity">{t("voiceAi.settings.similarity", "Similarity")}</Label>
            <span className="text-xs text-muted-foreground">{similarity.toFixed(2)}</span>
          </div>
          <Slider id="voice-ai-similarity" min={0} max={1} step={0.05} value={[similarity]} disabled={locked} onValueChange={(value) => setSimilarity(value[0] ?? 0.75)} />
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>{t("voiceAi.confirm.similarityLow", "Low · 0")}</span>
            <span>{t("voiceAi.confirm.similarityHigh", "High · 1")}</span>
          </div>
        </div>
        {voiceModelUsesSpeed(model) ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="voice-ai-speed">{t("voiceAi.settings.speed", "Speed")}</Label>
              <span className="text-xs text-muted-foreground">{speed.toFixed(2)}</span>
            </div>
            <Slider id="voice-ai-speed" min={0.7} max={1.2} step={0.05} value={[speed]} disabled={locked} onValueChange={(value) => setSpeed(value[0] ?? 1)} />
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>0.7</span>
              <span>1.2</span>
            </div>
          </div>
        ) : null}
      </div>
      {voiceModelUsesSpeed(model) ? null : (
        <p className="-mt-4 text-xs text-muted-foreground">{t("voiceAi.settings.speedHidden", "This model does not use speed.")}</p>
      )}
      <div className="space-y-2">
        <Label htmlFor="voice-ai-limit">{t("voiceAi.settings.limit", "Daily Limit")}</Label>
        <Input id="voice-ai-limit" type="number" min={1} max={500} value={dailyLimit} disabled={locked} onChange={(event) => setDailyLimit(Math.max(1, Number.parseInt(event.target.value, 10) || 50))} />
        <p className="text-xs text-muted-foreground">{t("voiceAi.settings.limitHelp", "Maximum voice generations per day for this organization.")}</p>
      </div>
      {locked ? (
        <Button type="button" variant="outline" onClick={() => setEditing(true)}>
          {t("voiceAi.settings.edit", "Edit")}
        </Button>
      ) : (
        <div className="flex items-center gap-2">
          {configRow ? (
            <Button type="button" variant="outline" disabled={isSaving} onClick={cancel}>
              {t("voiceAi.settings.cancel", "Cancel")}
            </Button>
          ) : null}
          <Button type="button" onClick={() => void save()} disabled={isSaving || !isDirty}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isSaving ? t("voiceAi.settings.saving", "Saving...") : t("voiceAi.settings.save", "Save")}
          </Button>
        </div>
      )}
      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("voiceAi.settings.removeTitle", "Remove the ElevenLabs API key?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("voiceAi.settings.removeBody", "Voice generation for this organization stops until a new key is saved.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>{t("voiceAi.settings.cancel", "Cancel")}</AlertDialogCancel>
            <Button type="button" variant="destructive" disabled={isRemoving} onClick={() => void removeKey()}>
              {t("voiceAi.settings.remove", "Remove")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
