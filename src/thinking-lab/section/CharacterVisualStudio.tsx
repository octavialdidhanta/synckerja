import { useEffect, useRef, useState, type CSSProperties, type Ref } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Loader2, Plus, Sparkles, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { supabase } from "@/shared/lib/supabaseClient";
import { cn } from "@/shared/lib/utils";
import { characterVisualUrl } from "@/thinking-lab/execution/generateCharacterVisual";
import { useClipboardImagePaste } from "@/6-1-dashboard/modal/useClipboardImagePaste";
import type { ScriptAsset } from "@/thinking-lab/execution/script";

export type CharacterStudioTab = "portrait" | "body";

type ProjectImage = { id: string; name: string; path: string; url: string };

const BUCKET = "digital-asset-character-images";

function useSignedVisual(path?: string, revision = 0) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!path) {
      setUrl(null);
      return;
    }
    let cancel = false;
    setUrl(null);
    void characterVisualUrl(path).then((next) => {
      if (!cancel) setUrl(next);
    });
    return () => {
      cancel = true;
    };
  }, [path, revision]);
  return url;
}

function useProjectCharacterImages(enabled: boolean) {
  const { organizationId } = useCurrentOrg();
  return useQuery({
    queryKey: ["thinking-lab-project-character-images", organizationId],
    enabled: enabled && Boolean(organizationId),
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<ProjectImage[]> => {
      if (!organizationId) return [];
      const [characters, images] = await Promise.all([
        supabase.from("digital_asset_characters").select("id, name, reference_image_path").eq("organization_id", organizationId),
        supabase.from("digital_asset_character_images").select("id, character_id, storage_path").eq("organization_id", organizationId),
      ]);
      if (characters.error) throw characters.error;
      if (images.error) throw images.error;
      const names = new Map((characters.data ?? []).map((row) => [row.id as string, (row.name as string | null)?.trim() || "Character"]));
      const rows: Array<{ id: string; name: string; path: string }> = [];
      const seen = new Set<string>();
      for (const row of characters.data ?? []) {
        const path = typeof row.reference_image_path === "string" ? row.reference_image_path.trim() : "";
        if (!path || seen.has(path)) continue;
        seen.add(path);
        rows.push({ id: `ref-${row.id}`, name: names.get(row.id as string) ?? "Character", path });
      }
      for (const row of images.data ?? []) {
        const path = typeof row.storage_path === "string" ? row.storage_path.trim() : "";
        if (!path || seen.has(path)) continue;
        seen.add(path);
        rows.push({
          id: row.id as string,
          name: names.get(row.character_id as string) ?? "Character",
          path,
        });
      }
      if (rows.length === 0) return [];
      const signed = await supabase.storage.from(BUCKET).createSignedUrls(rows.map((row) => row.path), 60 * 60);
      return rows.flatMap((row, index) => {
        const url = signed.data?.[index]?.signedUrl;
        return url ? [{ ...row, url }] : [];
      });
    },
  });
}

function VisualSlot({
  kind,
  label,
  path,
  url,
  fileName,
  frameClassName,
  frameStyle,
  frameRef,
  onImageRatio,
  saving,
  deleting,
  disabled,
  onUploadFile,
  onUseProjectImage,
  onDelete,
  secondaryAction,
  showProjectPicker = true,
}: {
  kind: CharacterStudioTab;
  label: string;
  path?: string;
  url: string | null;
  fileName: string;
  frameClassName: string;
  frameStyle?: CSSProperties;
  frameRef?: Ref<HTMLDivElement>;
  onImageRatio?: (ratio: number) => void;
  saving: boolean;
  deleting: boolean;
  disabled: boolean;
  onUploadFile: (file: File) => void;
  onUseProjectImage: (storagePath: string) => void;
  onDelete: () => void;
  secondaryAction?: { label: string; pending: boolean; onClick: () => void };
  showProjectPicker?: boolean;
}) {
  const { t } = useAppTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [projectOpen, setProjectOpen] = useState(false);
  const project = useProjectCharacterImages(projectOpen && !path);
  const busy = saving || deleting || disabled;
  const paste = useClipboardImagePaste(!busy, (file) => {
    if (!file.type.startsWith("image/")) {
      toast.error(t("thinkingLab.execution.characterUploadFailed", "The character image could not be uploaded."));
      return;
    }
    onUploadFile(file);
  });

  const download = async () => {
    if (!url || !path) return;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("DOWNLOAD");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `${fileName}.${path.endsWith(".png") ? "png" : "jpg"}`;
      link.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      toast.error(t("thinkingLab.execution.characterDownloadFailed", "The character image could not be downloaded."));
    }
  };

  return (
    <div
      className="w-fit shrink-0 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      tabIndex={busy ? -1 : 0}
      onPointerEnter={paste.arm}
      onFocus={paste.arm}
    >
      <p className="mb-2 text-center text-sm font-medium text-foreground">{label}</p>
      {path ? (
        <div
          ref={frameRef}
          style={frameStyle}
          className={cn("relative overflow-hidden rounded-2xl border border-border bg-white", frameClassName)}
        >
          {url ? (
            <img
              src={url}
              alt={label}
              className="h-full w-full object-contain"
              onLoad={(event) => {
                const image = event.currentTarget;
                if (image.naturalWidth > 0 && image.naturalHeight > 0) {
                  onImageRatio?.(image.naturalWidth / image.naturalHeight);
                }
              }}
            />
          ) : (
            <div className="h-full w-full animate-pulse bg-muted" aria-hidden />
          )}
          <div className="absolute right-2 top-2 flex gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8 w-8 p-0 shadow-sm"
              aria-label={t("thinkingLab.execution.downloadVisual", "Download")}
              title={t("thinkingLab.execution.downloadVisual", "Download")}
              disabled={!url || busy}
              onClick={() => void download()}
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8 w-8 p-0 shadow-sm"
              aria-label={kind === "portrait" ? t("thinkingLab.execution.deletePortrait", "Delete portrait") : t("thinkingLab.execution.deleteBody", "Delete body")}
              title={t("thinkingLab.execution.deleteVisual", "Delete")}
              disabled={busy}
              onClick={onDelete}
            >
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Trash2 className="h-3.5 w-3.5" aria-hidden />}
            </Button>
          </div>
        </div>
      ) : null}
      {path && secondaryAction ? (
        <div className="mt-2 flex justify-center">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 rounded-md px-2.5 text-xs"
            disabled={busy || secondaryAction.pending}
            onClick={secondaryAction.onClick}
          >
            {secondaryAction.pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Sparkles className="h-3.5 w-3.5" aria-hidden />}
            {secondaryAction.label}
          </Button>
        </div>
      ) : null}
      {!path ? (
        <div
          ref={frameRef}
          style={frameStyle}
          className={cn("flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/50 px-4 py-8", frameClassName)}
        >
          {projectOpen ? (
            <div className="flex w-full flex-col items-center gap-3">
              <p className="text-center text-sm font-medium text-foreground">
                {t("thinkingLab.execution.pickFromProject", "Choose a character image from the project")}
              </p>
              {project.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : project.data && project.data.length > 0 ? (
                <div className="grid max-h-64 w-full grid-cols-3 gap-2 overflow-y-auto">
                  {project.data.map((image) => (
                    <button
                      key={image.id}
                      type="button"
                      className="overflow-hidden rounded-lg border border-border bg-white text-left disabled:opacity-50"
                      disabled={busy}
                      onClick={() => onUseProjectImage(image.path)}
                    >
                      <img src={image.url} alt="" className="aspect-[3/4] w-full object-cover" />
                      <span className="block truncate px-1.5 py-1 text-[11px] text-foreground">{image.name}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-center text-xs text-muted-foreground">
                  {t("thinkingLab.execution.projectEmpty", "This project has no character images yet.")}
                </p>
              )}
              <Button type="button" size="sm" variant="outline" className="h-7 rounded-md px-2.5 text-xs" onClick={() => setProjectOpen(false)}>
                {t("thinkingLab.execution.projectBack", "Back")}
              </Button>
            </div>
          ) : (
            <>
              <p className="text-center text-sm font-medium text-foreground">
                {t("thinkingLab.execution.characterVisualEmpty", "Create or add your character image")}
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 rounded-md px-2.5 text-xs"
                  disabled={busy}
                  onClick={() => fileRef.current?.click()}
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Upload className="h-3.5 w-3.5" aria-hidden />}
                  {t("thinkingLab.execution.uploadCharacter", "Upload")}
                </Button>
                {secondaryAction || showProjectPicker ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 rounded-md px-2.5 text-xs"
                  disabled={busy || secondaryAction?.pending}
                  onClick={secondaryAction ? secondaryAction.onClick : () => setProjectOpen(true)}
                >
                  {secondaryAction?.pending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : secondaryAction ? (
                    <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <Plus className="h-3.5 w-3.5" aria-hidden />
                  )}
                  {secondaryAction?.label ?? t("thinkingLab.execution.addFromProject", "Add from project")}
                </Button>
                ) : null}
              </div>
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                {t("thinkingLab.execution.characterPasteHint", "Ctrl+V to paste a screenshot")}
              </p>
            </>
          )}
        </div>
      ) : null}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          if (!file.type.startsWith("image/")) {
            toast.error(t("thinkingLab.execution.characterUploadFailed", "The character image could not be uploaded."));
            return;
          }
          onUploadFile(file);
        }}
      />
    </div>
  );
}

export function CharacterVisualSlots({
  character,
  savingKind = null,
  deletingKind = null,
  disabled = false,
  onUploadFile,
  onUseProjectImage,
  onDelete,
  onGenerate,
  generateLabel,
  generating = false,
  showProjectPicker = true,
}: {
  character: ScriptAsset;
  savingKind?: CharacterStudioTab | null;
  deletingKind?: CharacterStudioTab | "sheet" | null;
  disabled?: boolean;
  onUploadFile: (kind: CharacterStudioTab, file: File) => void;
  onUseProjectImage: (kind: CharacterStudioTab, storagePath: string) => void;
  onDelete: (kind: CharacterStudioTab) => void;
  onGenerate?: () => void;
  generateLabel?: string;
  generating?: boolean;
  showProjectPicker?: boolean;
}) {
  const { t } = useAppTranslation();
  const portraitUrl = useSignedVisual(character.portraitPath, character.visualRevision);
  const bodyUrl = useSignedVisual(character.bodyPath, character.visualRevision);
  const fileName = character.handle.replace(/^@/, "");
  const portraitFrameRef = useRef<HTMLDivElement | null>(null);
  const [portraitHeight, setPortraitHeight] = useState(0);
  const [bodyRatio, setBodyRatio] = useState<number | null>(null);
  useEffect(() => {
    setBodyRatio(null);
  }, [character.bodyPath, character.visualRevision]);

  useEffect(() => {
    const node = portraitFrameRef.current;
    if (!node) return;
    const measure = () => setPortraitHeight(Math.round(node.getBoundingClientRect().height));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [character.portraitPath, portraitUrl]);

  const bodyFrameStyle: CSSProperties | undefined =
    portraitHeight > 0 && bodyRatio
      ? { width: Math.round(portraitHeight * bodyRatio), height: portraitHeight }
      : undefined;

  return (
    <div className="mx-auto mt-3 flex w-fit max-w-full items-start gap-3 overflow-x-auto">
      <VisualSlot
        kind="portrait"
        label={t("thinkingLab.execution.characterPortraitTab", "Portrait")}
        path={character.portraitPath}
        url={portraitUrl}
        fileName={`${fileName}-potret`}
        frameClassName="aspect-[4/5] w-72"
        frameRef={portraitFrameRef}
        saving={savingKind === "portrait"}
        deleting={deletingKind === "portrait"}
        disabled={disabled || Boolean(savingKind) || Boolean(deletingKind)}
        onUploadFile={(file) => onUploadFile("portrait", file)}
        onUseProjectImage={(storagePath) => onUseProjectImage("portrait", storagePath)}
        onDelete={() => onDelete("portrait")}
        showProjectPicker={showProjectPicker}
      />
      <VisualSlot
        kind="body"
        label={t("thinkingLab.execution.characterBodyTab", "Create body")}
        path={character.bodyPath}
        url={bodyUrl}
        fileName={`${fileName}-badan`}
        frameClassName={portraitHeight > 0 && bodyRatio ? "max-h-full" : "aspect-[4/5] w-72"}
        frameStyle={bodyFrameStyle}
        onImageRatio={setBodyRatio}
        saving={savingKind === "body"}
        deleting={deletingKind === "body"}
        disabled={disabled || Boolean(savingKind) || Boolean(deletingKind)}
        onUploadFile={(file) => onUploadFile("body", file)}
        onUseProjectImage={(storagePath) => onUseProjectImage("body", storagePath)}
        onDelete={() => onDelete("body")}
        secondaryAction={
          onGenerate
            ? { label: generateLabel ?? "Generate", pending: generating, onClick: onGenerate }
            : undefined
        }
        showProjectPicker={showProjectPicker && !onGenerate}
      />
    </div>
  );
}
