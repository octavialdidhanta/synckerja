import React, { useEffect, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/shared/lib/supabaseClient";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { diffHasChanges, diffLines, voiceOverFromConcept, type BriefDiffLine } from "./briefVersionDiff";
import { changedBriefFields, type BriefChangedField } from "./briefVersionLog";

export type RestoredBriefVersion = {
  brief: string;
  concept: string;
  caption: string;
  link: string;
};

type BriefVersionRow = RestoredBriefVersion & {
  id: string;
  versionNo: number;
  createdAt: string;
  authorName: string | null;
  source: "office" | "mcp";
};

type CurrentBrief = {
  brief: string;
  concept: string;
  voiceOver: string;
  caption: string;
  link: string;
};

const FIELD_LABEL: Record<BriefChangedField, string> = {
  storyboard: "Storyboard",
  concept: "Konsep",
  caption: "Caption",
  link: "Link",
};

function formatVersionTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

function DiffBlock({ title, before, after, emptyLabel, sameLabel }: {
  title: string;
  before: string;
  after: string;
  emptyLabel: string;
  sameLabel: string;
}) {
  const lines = diffLines(before, after);
  return (
    <section className="min-w-0">
      <h4 className="mb-1 text-xs font-semibold text-gray-800">{title}</h4>
      {!before.trim() && !after.trim() ? (
        <p className="text-xs text-gray-500">{emptyLabel}</p>
      ) : !diffHasChanges(lines) ? (
        <p className="text-xs text-gray-500">{sameLabel}</p>
      ) : (
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded border border-gray-200 bg-white p-2 font-mono text-[11px] leading-5">
          {lines.map((line, index) => (
            <DiffRow key={`${line.kind}-${index}`} line={line} />
          ))}
        </pre>
      )}
    </section>
  );
}

function DiffRow({ line }: { line: BriefDiffLine }) {
  const tone = line.kind === "add"
    ? "bg-emerald-50 text-emerald-900"
    : line.kind === "remove"
      ? "bg-red-50 text-red-900"
      : "text-gray-700";
  const mark = line.kind === "add" ? "+" : line.kind === "remove" ? "-" : " ";
  return <div className={tone}>{mark} {line.text || " "}</div>;
}

export function BriefVersionHistory({
  planId,
  organizationId,
  current,
  canRestore,
  preferredVersionNo,
  onRestored,
}: {
  planId: string;
  organizationId: string | null;
  current: CurrentBrief;
  canRestore: boolean;
  preferredVersionNo?: number | null;
  onRestored: (version: RestoredBriefVersion) => void;
}) {
  const { t } = useAppTranslation();
  const [versions, setVersions] = useState<BriefVersionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setLoadError(false);
      const { data, error } = await supabase
        .from("content_brief_versions")
        .select("id, version_no, brief, concept, caption, link_reference, created_at, created_by, source")
        .eq("social_media_plan_id", planId)
        .order("version_no", { ascending: false });
      if (cancelled) return;
      if (error) {
        setLoadError(true);
        setVersions([]);
        setLoading(false);
        return;
      }
      const rows = data ?? [];
      const userIds = [...new Set(rows.map((row) => row.created_by).filter((id): id is string => Boolean(id)))];
      const names = new Map<string, string>();
      if (organizationId && userIds.length > 0) {
        const { data: employees } = await supabase
          .from("employees")
          .select("user_id, full_name")
          .eq("organization_id", organizationId)
          .in("user_id", userIds);
        for (const employee of employees ?? []) {
          if (employee.user_id && employee.full_name && !names.has(employee.user_id)) {
            names.set(employee.user_id, employee.full_name);
          }
        }
      }
      if (cancelled) return;
      const next = rows.map((row) => ({
        id: row.id,
        versionNo: row.version_no,
        brief: row.brief ?? "",
        concept: row.concept ?? "",
        caption: row.caption ?? "",
        link: row.link_reference ?? "",
        createdAt: row.created_at,
        authorName: row.created_by ? names.get(row.created_by) ?? null : null,
        source: row.source === "mcp" ? "mcp" : "office",
      }));
      setVersions(next);
      setSelectedId((currentId) => currentId && next.some((row) => row.id === currentId) ? currentId : next[0]?.id ?? null);
      setLoading(false);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [planId, organizationId, reloadToken]);

  useEffect(() => {
    if (preferredVersionNo == null) return;
    const match = versions.find((version) => version.versionNo === preferredVersionNo);
    if (match) setSelectedId(match.id);
  }, [preferredVersionNo, versions]);

  const selected = versions.find((version) => version.id === selectedId) ?? null;

  const editLog = (version: BriefVersionRow, index: number) => {
    const after = index === 0
      ? { brief: current.brief, concept: current.concept, caption: current.caption, link: current.link }
      : versions[index - 1];
    const fields = changedBriefFields(version, after).map((field) => (
      t(`briefDialog.history.field.${field}`, FIELD_LABEL[field])
    ));
    const source = t(
      version.source === "mcp" ? "briefDialog.history.source.mcp" : "briefDialog.history.source.office",
      version.source === "mcp" ? "MCP" : "Office",
    );
    return fields.length > 0 ? `${source} · ${fields.join(", ")}` : source;
  };

  const restore = async () => {
    if (!selected || !canRestore) return;
    setRestoring(true);
    const { error } = await supabase.rpc("restore_content_brief_version", { p_version_id: selected.id });
    setRestoring(false);
    if (error) {
      toast.error(t("briefDialog.history.restoreFailed", "Gagal mengembalikan versi brief"));
      setConfirming(false);
      return;
    }
    setConfirming(false);
    setReloadToken((token) => token + 1);
    onRestored({
      brief: selected.brief,
      concept: selected.concept,
      caption: selected.caption,
      link: selected.link,
    });
  };

  if (loading) {
    return <p className="px-4 py-3 text-sm text-gray-500">{t("briefDialog.history.loading", "Memuat riwayat...")}</p>;
  }
  if (loadError) {
    return <p className="px-4 py-3 text-sm text-red-600">{t("briefDialog.history.loadFailed", "Gagal memuat riwayat brief")}</p>;
  }
  if (versions.length === 0) {
    return (
      <p className="px-4 py-3 text-sm text-gray-500">
        {t("briefDialog.history.empty", "Belum ada riwayat. Versi tersimpan saat brief diubah.")}
      </p>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-4 py-3">
      <div className="flex min-h-0 flex-1 gap-3 overflow-hidden">
        <ul className="w-52 shrink-0 space-y-1 overflow-y-auto pr-1">
          {versions.map((version, index) => (
            <li key={version.id}>
              <button
                type="button"
                onClick={() => {
                  setSelectedId(version.id);
                  setConfirming(false);
                }}
                className={`w-full rounded border px-2 py-1.5 text-left text-xs ${
                  version.id === selectedId ? "border-gray-900 bg-gray-50" : "border-gray-200 bg-white"
                }`}
              >
                <span className="block font-medium text-gray-900">
                  {t("briefDialog.history.version", "Versi {{no}}", { no: version.versionNo })}
                </span>
                <span className="block text-gray-500">{formatVersionTime(version.createdAt)}</span>
                <span className="block truncate text-gray-500">{version.authorName ?? "—"}</span>
                <span className="block truncate text-gray-500">{editLog(version, index)}</span>
              </button>
            </li>
          ))}
        </ul>
        {selected ? (
          <div className="min-h-0 min-w-0 flex-1 space-y-3 overflow-y-auto pr-1">
            <DiffBlock
              title={t("briefDialog.history.storyboard", "Storyboard")}
              before={selected.brief}
              after={current.brief}
              emptyLabel={t("briefDialog.history.emptySection", "Kosong")}
              sameLabel={t("briefDialog.history.same", "Sama dengan isi sekarang")}
            />
            <DiffBlock
              title={t("briefDialog.conceptVoiceOver", "Naskah VO")}
              before={voiceOverFromConcept(selected.concept)}
              after={current.voiceOver}
              emptyLabel={t("briefDialog.history.emptySection", "Kosong")}
              sameLabel={t("briefDialog.history.same", "Sama dengan isi sekarang")}
            />
            <DiffBlock
              title={t("briefDialog.sectionCaption", "Caption")}
              before={selected.caption}
              after={current.caption}
              emptyLabel={t("briefDialog.history.emptySection", "Kosong")}
              sameLabel={t("briefDialog.history.same", "Sama dengan isi sekarang")}
            />
            <DiffBlock
              title={t("briefDialog.history.link", "Link referensi")}
              before={selected.link}
              after={current.link}
              emptyLabel={t("briefDialog.history.emptySection", "Kosong")}
              sameLabel={t("briefDialog.history.same", "Sama dengan isi sekarang")}
            />
          </div>
        ) : null}
      </div>
      {canRestore ? (
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-gray-100 pt-2">
          {confirming ? (
            <>
              <p className="mr-auto text-xs text-gray-600">
                {t("briefDialog.history.confirm", "Kembalikan ke versi ini? Isi sekarang tersimpan sebagai versi baru.")}
              </p>
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setConfirming(false)} disabled={restoring}>
                {t("briefDialog.cancel", "Batal")}
              </Button>
              <Button type="button" size="sm" className="h-7 text-xs" onClick={() => void restore()} disabled={restoring}>
                {t("briefDialog.history.restore", "Kembalikan")}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              size="sm"
              className="h-7 text-xs"
              disabled={!selected || restoring}
              onClick={() => setConfirming(true)}
            >
              {t("briefDialog.history.restore", "Kembalikan")}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
