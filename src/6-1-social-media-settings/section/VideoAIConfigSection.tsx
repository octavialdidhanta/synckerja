import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
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
import { toast } from "sonner";

type VideoProvider = "byteplus" | "gemini";

type VideoAIConfigRow = {
  id: string;
  organization_id: string;
  api_key_configured: boolean;
  daily_limit: number;
  provider?: VideoProvider | null;
};

const CONFIG_SELECT = "id, organization_id, api_key_configured, daily_limit, provider";

function asProvider(value: string | null | undefined): VideoProvider {
  return value === "gemini" ? "gemini" : "byteplus";
}

export const VideoAIConfigSection: React.FC = () => {
  const { t } = useAppTranslation();
  const { organizationId } = useCurrentOrg();
  const queryClient = useQueryClient();
  const { data: configRow, isPending, isError } = useQuery({
    queryKey: ["video-ai-config", organizationId],
    enabled: Boolean(organizationId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_video_ai_config")
        .select(CONFIG_SELECT)
        .eq("organization_id", organizationId as string)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as VideoAIConfigRow | null;
    },
  });
  const { data: scriptReady } = useQuery({
    queryKey: ["script-ai-gemini-ready", organizationId],
    enabled: Boolean(organizationId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_script_ai_config")
        .select("api_key_configured")
        .eq("organization_id", organizationId as string)
        .maybeSingle();
      if (error) throw error;
      return Boolean(data?.api_key_configured);
    },
  });
  const [provider, setProvider] = useState<VideoProvider>("byteplus");
  const [dailyLimit, setDailyLimit] = useState(20);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [appliedKey, setAppliedKey] = useState("");

  const serverKey = configRow
    ? `${configRow.id}:${configRow.daily_limit}:${configRow.api_key_configured}:${configRow.provider ?? "byteplus"}`
    : "";
  if (serverKey !== appliedKey && !apiKeyInput.trim()) {
    setAppliedKey(serverKey);
    setDailyLimit(configRow?.daily_limit ?? 20);
    setProvider(asProvider(configRow?.provider));
  }

  const savedLimit = configRow?.daily_limit ?? 20;
  const savedProvider = asProvider(configRow?.provider);
  const isDirty = !configRow || provider !== savedProvider || Number(dailyLimit) !== Number(savedLimit) || apiKeyInput.trim().length > 0;

  const save = async () => {
    if (!organizationId) return;
    if (provider === "byteplus" && !configRow?.api_key_configured && !apiKeyInput.trim()) {
      toast.error(t("videoAi.settings.keyRequired", "API key BytePlus wajib diisi."));
      return;
    }
    setIsSaving(true);
    try {
      const payload: Record<string, unknown> = {
        provider,
        daily_limit: Math.max(1, Number(dailyLimit) || 20),
      };
      if (apiKeyInput.trim()) {
        payload.byteplus_api_key = apiKeyInput.trim();
        payload.api_key_configured = true;
      }
      const query = configRow?.id
        ? supabase.from("organization_video_ai_config").update(payload).eq("id", configRow.id)
        : supabase.from("organization_video_ai_config").insert({
            ...payload,
            organization_id: organizationId,
            api_key_configured: Boolean(apiKeyInput.trim()),
          });
      const { error } = await query;
      if (error) throw error;
      setApiKeyInput("");
      await queryClient.invalidateQueries({ queryKey: ["video-ai-config", organizationId] });
      toast.success(t("videoAi.settings.saved", "Konfigurasi video berhasil disimpan"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("videoAi.settings.saveFailed", "Gagal menyimpan konfigurasi video"));
    } finally {
      setIsSaving(false);
    }
  };

  const removeKey = async () => {
    if (!configRow?.id) return;
    setIsRemoving(true);
    try {
      const { error } = await supabase
        .from("organization_video_ai_config")
        .update({ byteplus_api_key: null, api_key_configured: false })
        .eq("id", configRow.id);
      if (error) throw error;
      setConfirmRemove(false);
      await queryClient.invalidateQueries({ queryKey: ["video-ai-config", organizationId] });
      toast.success(t("videoAi.settings.keyRemoved", "API key berhasil dihapus"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("videoAi.settings.removeFailed", "Gagal menghapus API key"));
    } finally {
      setIsRemoving(false);
    }
  };

  if (!organizationId || isPending) return null;
  if (isError) {
    return <p className="text-sm text-destructive">{t("videoAi.settings.loadFailed", "Konfigurasi video tidak bisa dibaca.")}</p>;
  }

  return (
    <div className="max-w-xl space-y-6">
      <div className="space-y-3 rounded-lg border p-4">
        <Label id="video-provider-label">{t("videoAi.settings.provider", "Video provider")}</Label>
        <div role="tablist" aria-labelledby="video-provider-label" className="grid grid-cols-2 gap-2">
          {(["byteplus", "gemini"] as const).map((id) => {
            const selected = provider === id;
            return (
              <Button
                key={id}
                type="button"
                role="tab"
                aria-selected={selected}
                variant={selected ? "default" : "outline"}
                className="h-auto min-h-10 whitespace-normal px-3 py-2 text-sm"
                onClick={() => setProvider(id)}
              >
                {id === "byteplus" ? t("videoAi.settings.byteplus", "BytePlus") : t("videoAi.settings.gemini", "Gemini")}
              </Button>
            );
          })}
        </div>
      </div>
      {provider === "gemini" ? (
        <div className="space-y-2">
          <Label>{t("videoAi.settings.geminiKey", "Gemini API Key")}</Label>
          <p className="text-xs text-muted-foreground">
            {scriptReady
              ? t("videoAi.settings.geminiUsesScriptKey", "Video Gemini memakai API key yang sama dengan Script AI. Key tidak disalin ke sini.")
              : t("videoAi.settings.geminiKeyMissing", "Gemini API key belum ada. Isi di Settings > Script AI Generator.")}
          </p>
        </div>
      ) : (
      <div className="space-y-2">
        <Label htmlFor="video-ai-key">{t("videoAi.settings.key", "BytePlus API Key")}</Label>
        <div className="flex items-center gap-2">
          <Input
            id="video-ai-key"
            type="password"
            autoComplete="off"
            value={apiKeyInput}
            onChange={(event) => setApiKeyInput(event.target.value)}
            placeholder={
              configRow?.api_key_configured
                ? t("videoAi.settings.keySet", "•••••••••••• API key sudah dikonfigurasi")
                : t("videoAi.settings.keyEmpty", "Masukkan API key dari BytePlus ModelArk")
            }
          />
          {configRow?.api_key_configured ? (
            <Button type="button" variant="outline" className="shrink-0 text-destructive" onClick={() => setConfirmRemove(true)}>
              <Trash2 className="mr-1 h-4 w-4" />
              {t("videoAi.settings.remove", "Hapus API Key")}
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          {t("videoAi.settings.keyHelp", "Key ini hanya untuk organisasi yang sedang aktif. Organisasi lain harus mengisi key mereka sendiri. Key tidak ditampilkan setelah disimpan.")}{" "}
          <a className="inline-flex items-center gap-1 text-primary underline" href="https://console.byteplus.com/ark" target="_blank" rel="noreferrer">
            {t("videoAi.settings.createKey", "Buat key")}
            <ExternalLink className="h-3 w-3" />
          </a>
        </p>
      </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="video-ai-limit">{t("videoAi.settings.limit", "Daily Limit")}</Label>
        <Input
          id="video-ai-limit"
          type="number"
          min={1}
          max={500}
          value={dailyLimit}
          onChange={(event) => setDailyLimit(Math.max(1, Number.parseInt(event.target.value, 10) || 20))}
        />
        <p className="text-xs text-muted-foreground">
          {t("videoAi.settings.limitHelp", "Maksimum video per hari untuk organisasi ini, dipakai bersama oleh BytePlus dan Gemini.")}
        </p>
      </div>
      <Button type="button" onClick={() => void save()} disabled={isSaving || !isDirty}>
        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {isSaving
          ? t("videoAi.settings.saving", "Menyimpan...")
          : isDirty
            ? t("videoAi.settings.save", "Simpan")
            : t("videoAi.settings.stored", "Tersimpan")}
      </Button>
      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("videoAi.settings.removeTitle", "Hapus API key video?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("videoAi.settings.removeBody", "Generate video untuk organisasi ini berhenti sampai key baru disimpan.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRemoving}>{t("videoAi.settings.cancel", "Batal")}</AlertDialogCancel>
            <Button type="button" variant="destructive" disabled={isRemoving} onClick={() => void removeKey()}>
              {t("videoAi.settings.remove", "Hapus API Key")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
