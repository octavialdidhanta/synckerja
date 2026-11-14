import { useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { cn } from "@/shared/lib/utils";
import type { CharacterVisualKind, VoiceOverScript } from "@/thinking-lab/execution/script";
import { characterVisualUrl, type CharacterGeneratePhase } from "@/thinking-lab/execution/generateCharacterVisual";
import { CharacterVisualSlots, type CharacterStudioTab } from "@/thinking-lab/section/CharacterVisualStudio";

export type CharacterGenerateState = { handle: string; phase: CharacterGeneratePhase } | null;

export function StoredCharacterImage({
  path,
  revision = 0,
  alt,
  className,
  deleteLabel,
  deleting = false,
  disabled = false,
  onDelete,
}: {
  path: string;
  revision?: number;
  alt: string;
  className: string;
  deleteLabel: string;
  deleting?: boolean;
  disabled?: boolean;
  onDelete?: () => void;
}) {
  const { t } = useAppTranslation();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancel = false;
    setUrl(null);
    void characterVisualUrl(path).then((next) => {
      if (!cancel) setUrl(next);
    });
    return () => {
      cancel = true;
    };
  }, [path, revision]);
  return (
    <div className={cn("relative", className)}>
      {url ? (
        <img key={`${path}-${revision}`} src={url} alt={alt} className="h-full w-full rounded-md bg-white object-contain" />
      ) : (
        <div className="h-full w-full animate-pulse rounded-md bg-muted" aria-hidden />
      )}
      {onDelete ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="absolute right-1.5 top-1.5 h-7 gap-1 rounded-md px-2 text-xs shadow-sm"
          aria-label={deleteLabel}
          title={deleteLabel}
          disabled={disabled || deleting}
          onClick={onDelete}
        >
          {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Trash2 className="h-3.5 w-3.5" aria-hidden />}
          {t("thinkingLab.execution.deleteVisual", "Delete")}
        </Button>
      ) : null}
    </div>
  );
}

export function AssetList({
  script,
  onGenerateCharacter,
  onStoreCharacterVisual,
  onDeleteCharacterVisual,
  generating = null,
  deleting = null,
  saving = null,
}: {
  script: VoiceOverScript;
  onGenerateCharacter?: (handle: string) => void;
  onStoreCharacterVisual?: (handle: string, kind: CharacterStudioTab, source: File | { storagePath: string }) => void;
  onDeleteCharacterVisual?: (handle: string, kind: CharacterVisualKind) => void;
  generating?: CharacterGenerateState;
  deleting?: { handle: string; kind: CharacterVisualKind } | null;
  saving?: { handle: string; kind: CharacterStudioTab } | null;
}) {
  const { t } = useAppTranslation();
  const groups = [
    ["Location", script.assets.locations, false],
    ["Character", script.assets.characters, true],
    ["Property", script.assets.properties, false],
  ] as const;
  return (
    <div className="space-y-3 text-sm">
      {groups.map(([label, items, isCharacter]) =>
        items.length === 0 ? null : (
          <div key={label}>
            <p className="font-medium text-foreground">{label}</p>
            <ul className="mt-1 space-y-3">
              {items.map((item) => {
                const busy = generating?.handle === item.handle;
                const hasVisual = Boolean(item.portraitPath || item.sheetPath);
                return (
                  <li key={item.handle} className="text-muted-foreground">
                    <div className="flex items-start gap-2">
                      <p className="min-w-0 flex-1">
                        <span className="font-medium text-foreground">{item.handle}</span>
                        {item.description ? ` ${item.description}` : ""}
                      </p>
                    </div>
                    {isCharacter && onStoreCharacterVisual && onDeleteCharacterVisual ? (
                      <CharacterVisualSlots
                        character={item}
                        savingKind={saving?.handle === item.handle ? saving.kind : null}
                        deletingKind={deleting?.handle === item.handle ? deleting.kind : null}
                        disabled={Boolean(generating) || (Boolean(deleting) && deleting?.handle !== item.handle) || (Boolean(saving) && saving?.handle !== item.handle)}
                        onUploadFile={(kind, file) => onStoreCharacterVisual(item.handle, kind, file)}
                        onUseProjectImage={(kind, storagePath) => onStoreCharacterVisual(item.handle, kind, { storagePath })}
                        onDelete={(kind) => onDeleteCharacterVisual(item.handle, kind)}
                        onDeleteSheet={() => onDeleteCharacterVisual(item.handle, "sheet")}
                        onGenerate={onGenerateCharacter ? () => onGenerateCharacter(item.handle) : undefined}
                        generating={busy}
                        generateLabel={
                          busy
                            ? generating?.phase === "sheet"
                              ? t("thinkingLab.execution.generatingSheet", "Character sheet...")
                              : t("thinkingLab.execution.generatingPortrait", "Portrait...")
                            : hasVisual
                              ? t("thinkingLab.execution.regenerateCharacter", "Generate again")
                              : t("thinkingLab.execution.generateCharacter", "Generate")
                        }
                      />
                    ) : null}
                    {/* With the visual slots, the sheet is shown in the body slot (same row as the portrait). */}
                    {isCharacter && item.sheetPath && !(onStoreCharacterVisual && onDeleteCharacterVisual) ? (
                      <StoredCharacterImage
                        path={item.sheetPath}
                        revision={item.visualRevision}
                        alt={t("thinkingLab.execution.characterSheet", "Character sheet")}
                        className="mx-auto mt-4 aspect-video w-full max-w-xl"
                        deleteLabel={t("thinkingLab.execution.deleteSheet", "Delete character sheet")}
                        deleting={deleting?.handle === item.handle && deleting.kind === "sheet"}
                        disabled={Boolean(generating) || Boolean(deleting) || Boolean(saving)}
                        onDelete={onDeleteCharacterVisual ? () => onDeleteCharacterVisual(item.handle, "sheet") : undefined}
                      />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ),
      )}
    </div>
  );
}
