import { useEffect, useState, type ClipboardEvent } from "react";
import { Loader2, X } from "lucide-react";
import { supabase } from "@/shared/lib/supabaseClient";
import { cn } from "@/shared/lib/utils";
import { classifyAiEmployeeError } from "./parse";
import type { BriefReference } from "./types";

const SLOTS = [1, 2, 3, 4, 5] as const;

type ReferenceFieldProps = {
  references: BriefReference[];
  canEdit: boolean;
  onSave: (position: number, file: File) => Promise<void>;
  onClear: (position: number) => Promise<void>;
};

function messageFor(error: unknown): string {
  const kind = classifyAiEmployeeError(error);
  if (kind === "invalid") return "Gambar harus PNG, JPEG, atau WEBP, paling besar 5 MB.";
  if (kind === "forbidden") return "Hanya owner yang bisa mengubah referensi.";
  return "Referensi belum tersimpan.";
}

export function ReferenceField({ references, canEdit, onSave, onClear }: ReferenceFieldProps) {
  const [selected, setSelected] = useState(1);
  const [busy, setBusy] = useState<number | null>(null);
  const [urls, setUrls] = useState<Record<number, string>>({});
  const [error, setError] = useState("");
  const stored = references.map((item) => `${item.position}:${item.storagePath}`).join("|");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const next: Record<number, string> = {};
      await Promise.all(references.map(async (item) => {
        const { data } = await supabase.storage
          .from("ai-employee-references")
          .createSignedUrl(item.storagePath, 3600);
        if (data?.signedUrl) next[item.position] = data.signedUrl;
      }));
      if (!cancelled) setUrls(next);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [stored, references]);

  const run = async (position: number, action: () => Promise<void>) => {
    setBusy(position);
    setError("");
    try {
      await action();
    } catch (caught) {
      setError(messageFor(caught));
    } finally {
      setBusy(null);
    }
  };

  const pasteInto = (position: number, event: ClipboardEvent) => {
    if (!canEdit || busy != null) return;
    const file = Array.from(event.clipboardData.items)
      .find((item) => item.type.startsWith("image/"))
      ?.getAsFile();
    if (!file) return;
    event.preventDefault();
    void run(position, () => onSave(position, file));
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {SLOTS.map((position) => {
          const url = urls[position];
          const filled = references.some((item) => item.position === position);
          return (
            <div key={position} className="relative">
              <div
                role="button"
                tabIndex={canEdit ? 0 : -1}
                aria-label={`Referensi ${position}`}
                onClick={() => setSelected(position)}
                onPaste={(event) => pasteInto(position, event)}
                className={cn(
                  "flex h-16 w-16 items-center justify-center overflow-hidden rounded-md border bg-muted text-[10px] text-muted-foreground",
                  selected === position && canEdit ? "ring-2 ring-primary" : "",
                  canEdit ? "cursor-pointer" : "",
                )}
              >
                {busy === position ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : url ? (
                  <img src={url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span>Tempel</span>
                )}
              </div>
              {canEdit && filled && busy !== position ? (
                <button
                  type="button"
                  aria-label={`Hapus referensi ${position}`}
                  className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border bg-background text-muted-foreground"
                  onClick={() => void run(position, () => onClear(position))}
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
      {canEdit ? (
        <p className="text-xs text-muted-foreground">
          Klik kotak, lalu tempel gambar. Tersimpan langsung.
        </p>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
