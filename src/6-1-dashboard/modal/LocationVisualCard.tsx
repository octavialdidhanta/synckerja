import { useEffect, useRef, useState } from "react";
import { Loader2, Sparkles, Trash2, Upload } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { characterVisualUrl } from "@/thinking-lab/execution/generateCharacterVisual";
import type { LocationFrame } from "@/6-1-dashboard/modal/briefConceptAssets";
import { useClipboardImagePaste } from "@/6-1-dashboard/modal/useClipboardImagePaste";

const FRAME_CLASS: Record<LocationFrame, string> = {
  "9:16": "aspect-[9/16] w-40",
  "4:5": "aspect-[4/5] w-52",
  "1:1": "aspect-square w-52",
  "16:9": "aspect-video w-72",
};

export function LocationVisualCard({
  label,
  path,
  revision = 0,
  frame,
  busy,
  generating,
  disabled = false,
  emptyLabel,
  deleteLabel,
  onUpload,
  onGenerate,
  onDelete,
}: {
  label: string;
  path?: string;
  revision?: number;
  frame: LocationFrame;
  busy: boolean;
  generating: boolean;
  disabled?: boolean;
  emptyLabel?: string;
  deleteLabel?: string;
  onUpload: (file: File) => void;
  onGenerate: () => void;
  onDelete: () => void;
}) {
  const { t } = useAppTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const blocked = busy || disabled;
  const paste = useClipboardImagePaste(!blocked, onUpload);

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

  const actions = (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 rounded-md bg-white px-2.5 text-xs"
        disabled={blocked}
        onClick={() => fileRef.current?.click()}
      >
        {busy && !generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Upload className="h-3.5 w-3.5" aria-hidden />}
        {t("briefDialog.conceptLocationUpload", "Upload")}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 rounded-md bg-white px-2.5 text-xs"
        disabled={blocked}
        onClick={onGenerate}
      >
        {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Sparkles className="h-3.5 w-3.5" aria-hidden />}
        {generating
          ? t("briefDialog.conceptLocationGenerating", "Generating...")
          : path
            ? t("briefDialog.conceptLocationGenerateAgain", "Generate again")
            : t("briefDialog.conceptLocationGenerate", "Generate")}
      </Button>
    </div>
  );

  return (
    <div
      className="mt-2 w-fit max-w-full rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      tabIndex={blocked ? -1 : 0}
      onPointerEnter={paste.arm}
      onFocus={paste.arm}
    >
      <div className={`relative overflow-hidden rounded-2xl border border-dashed border-border bg-muted/50 ${FRAME_CLASS[frame]}`}>
        {path && url ? (
          <img src={url} alt={label} className="h-full w-full object-cover" />
        ) : path ? (
          <div className="h-full w-full animate-pulse bg-muted" aria-hidden />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-3 text-center">
            <p className="text-sm font-medium text-foreground">
              {emptyLabel ?? t("briefDialog.conceptLocationImage", "Create or add your location image")}
            </p>
            {actions}
            <p className="text-[11px] text-muted-foreground">{t("briefDialog.conceptPasteHint", "Ctrl+V to paste a screenshot")}</p>
          </div>
        )}
        {path ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="absolute right-2 top-2 h-8 w-8 p-0 shadow-sm"
              aria-label={deleteLabel ?? t("briefDialog.conceptLocationDelete", "Delete location image")}
              disabled={blocked}
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
            </Button>
            <div className="absolute inset-x-2 bottom-2">{actions}</div>
          </>
        ) : null}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onUpload(file);
        }}
      />
    </div>
  );
}
