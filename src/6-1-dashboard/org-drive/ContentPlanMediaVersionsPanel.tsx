import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, ExternalLink, FolderOpen, Loader2, Lock, Upload } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/shared/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { cn } from "@/shared/lib/utils";
import {
  activateApprovedVersion,
  driveFileIdFromLink,
  fetchScheduleInfo,
  formatBytes,
  orgDriveErrorText,
  uploadContentPlanVideo,
  versionDriveLink,
  type ContentPlanMediaVersion,
  type PendingSchedule,
} from "./orgDriveApi";
import { planMediaVersionsKey, useOrgDriveSettings, usePlanMediaVersions } from "./useOrgDrive";

type Props = {
  planId: string;
  organizationId: string | null | undefined;
  /** Link currently saved on the plan (decides which version is "Aktif"). */
  savedLink: string;
  productionApproved: boolean;
  /** Put a link into the dialog's link field; the dialog saves it the normal way (Need Review, PIC, task step). */
  onUseLink: (link: string) => void;
  /** Production was approved and the server already switched the link. */
  onApprovedLinkSwitched: (link: string) => void;
};

type PendingActivation = {
  version: ContentPlanMediaVersion;
  link: string;
  approved: boolean;
  schedules: PendingSchedule[];
};

const dateFmt = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function platformLabel(p: string): string {
  const map: Record<string, string> = { instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", youtube: "YouTube", linkedin: "LinkedIn" };
  return map[p.toLowerCase()] ?? p;
}

export function ContentPlanMediaVersionsPanel({
  planId,
  organizationId,
  savedLink,
  productionApproved,
  onUseLink,
  onApprovedLinkSwitched,
}: Props) {
  const queryClient = useQueryClient();
  const settings = useOrgDriveSettings(organizationId);
  const connected = settings.data?.connected === true;
  const versions = usePlanMediaVersions(planId, connected);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(true);
  const [progress, setProgress] = useState<{ ratio: number; label: string } | null>(null);
  const [pending, setPending] = useState<PendingActivation | null>(null);
  const [busy, setBusy] = useState(false);

  const activeFileId = useMemo(() => driveFileIdFromLink(savedLink), [savedLink]);
  const list = versions.data ?? [];
  const activeVersion = list.find((v) => v.drive_file_id && v.drive_file_id === activeFileId) ?? null;
  const folderUrl = list[0]?.drive_folder_id ? `https://drive.google.com/drive/folders/${list[0].drive_folder_id}` : null;

  if (settings.isPending || !settings.data) return null;

  if (!connected) {
    return (
      <div className="flex-shrink-0 border-b border-gray-200 p-3 text-xs text-gray-500">
        Upload video langsung belum aktif: Google Drive org belum disambungkan
        {settings.data.canManage ? (
          <>
            {" "}
            (<a className="underline" href="/digital-marketing/social-media/settings?section=google-drive">sambungkan</a>)
          </>
        ) : (
          " (minta owner menyambungkan)"
        )}
        .
      </div>
    );
  }

  const refresh = () => void queryClient.invalidateQueries({ queryKey: planMediaVersionsKey(planId) });

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (inputRef.current) inputRef.current.value = "";
    setProgress({ ratio: 0, label: `Menyiapkan ${file.name}` });
    try {
      const result = await uploadContentPlanVideo({
        planId,
        file,
        onProgress: (p) => setProgress({ ratio: p.ratio, label: `Mengunggah · ${formatBytes(file.size)}` }),
      });
      refresh();
      onUseLink(result.googleDriveLink);
      toast.success(`v${result.versionNo} terunggah dan dipakai di konten ini.`);
      if (result.shareWarning) toast.warning("Video terunggah, tapi izin 'siapa pun dengan link' gagal diatur. Cek di Google Drive.");
    } catch (e) {
      refresh();
      toast.error(orgDriveErrorText(e));
    } finally {
      setProgress(null);
    }
  };

  const askActivate = async (v: ContentPlanMediaVersion) => {
    const link = versionDriveLink(v);
    if (!link) return;
    if (!productionApproved) {
      setPending({ version: v, link, approved: false, schedules: [] });
      return;
    }
    setBusy(true);
    try {
      const info = await fetchScheduleInfo(planId);
      if (!info.can_approve_production) {
        toast.error("Produksi sudah di-approve. Hanya yang boleh approve produksi yang bisa mengganti versi.");
        return;
      }
      setPending({ version: v, link, approved: true, schedules: info.pending });
    } catch (e) {
      toast.error(orgDriveErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  const confirmActivate = async (moveSchedules: boolean) => {
    if (!pending) return;
    const { version, link, approved } = pending;
    if (!approved) {
      onUseLink(link);
      setPending(null);
      toast.success(`v${version.version_no} dipakai. Status produksi menjadi Need Review.`);
      return;
    }
    setBusy(true);
    try {
      const res = await activateApprovedVersion(version.id, moveSchedules);
      onApprovedLinkSwitched(res.google_drive_link);
      refresh();
      if (res.moved_schedules > 0) toast.success(`v${version.version_no} aktif. ${res.moved_schedules} jadwal ikut pindah ke v${version.version_no}.`);
      else if (res.cancelled_schedules > 0) toast.success(`v${version.version_no} aktif. ${res.cancelled_schedules} jadwal dibatalkan, jadwalkan ulang bila perlu.`);
      else toast.success(`v${version.version_no} aktif.`);
      setPending(null);
    } catch (e) {
      toast.error(orgDriveErrorText(e));
    } finally {
      setBusy(false);
    }
  };

  const uploading = progress !== null;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="flex-shrink-0 border-b border-gray-200">
      <div className="p-3">
        <CollapsibleTrigger asChild>
          <button type="button" className="flex w-full items-center justify-between gap-2 rounded py-0.5 text-left transition-colors hover:bg-gray-50">
            <h4 className="text-sm font-medium text-gray-900">Video · Google Drive org</h4>
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              {list.filter((v) => v.status === "ready").length} versi
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-2 space-y-2">
            <input
              ref={inputRef}
              type="file"
              accept="video/mp4,video/quicktime,video/webm,video/x-m4v,.mp4,.mov,.webm,.m4v"
              className="hidden"
              onChange={(e) => void handleFile(e.target.files?.[0])}
            />
            <div className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-2">
              <span className="text-xs text-gray-500">
                {productionApproved ? (
                  <span className="inline-flex items-center gap-1">
                    <Lock className="h-3 w-3" /> Produksi sudah di-approve. Minta revisi untuk mengunggah versi baru.
                  </span>
                ) : (
                  <>Disimpan ke {settings.data.accountEmail ?? "Drive org"}</>
                )}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 shrink-0"
                disabled={productionApproved || uploading}
                onClick={() => inputRef.current?.click()}
              >
                {uploading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1 h-3.5 w-3.5" />}
                Upload video
              </Button>
            </div>

            {progress ? (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-600">
                  <span>{progress.label}</span>
                  <span>{Math.round(progress.ratio * 100)}%</span>
                </div>
                <div className="h-1.5 rounded bg-gray-100">
                  <div className="h-1.5 rounded bg-blue-600 transition-all" style={{ width: `${Math.round(progress.ratio * 100)}%` }} />
                </div>
              </div>
            ) : null}

            {versions.isPending ? (
              <p className="text-xs text-gray-400">Memuat versi…</p>
            ) : list.length === 0 ? (
              <p className="text-xs text-gray-400">Belum ada video yang diunggah lewat Synckerja untuk konten ini.</p>
            ) : (
              <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 text-xs">
                {list.map((v) => {
                  const isActive = v.id === activeVersion?.id;
                  const link = versionDriveLink(v);
                  return (
                    <div key={v.id} className={cn("flex items-center justify-between gap-2 px-3 py-2", !isActive && "text-gray-600")}>
                      <span className="min-w-0 truncate">
                        <span className="font-medium text-gray-900">v{v.version_no}</span>
                        {" · "}
                        {v.source === "mcp" ? "AI" : "Upload"}
                        {" · "}
                        {dateFmt.format(new Date(v.completed_at ?? v.created_at))}
                        {" · "}
                        {formatBytes(v.size_bytes)}
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        {v.status === "uploading" ? <span className="text-amber-600">Mengunggah</span> : null}
                        {v.status === "failed" ? <span className="text-red-600">Gagal</span> : null}
                        {isActive ? (
                          <span className="rounded bg-blue-50 px-2 py-0.5 font-medium text-blue-700">Aktif</span>
                        ) : v.status === "ready" ? (
                          <button
                            type="button"
                            className="text-gray-600 underline-offset-2 hover:underline disabled:opacity-50"
                            disabled={busy || uploading}
                            onClick={() => void askActivate(v)}
                          >
                            Jadikan aktif
                          </button>
                        ) : null}
                        {link ? (
                          <a href={link} target="_blank" rel="noreferrer" aria-label={`Buka v${v.version_no}`} className="text-gray-500 hover:text-gray-800">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : null}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {folderUrl ? (
              <a href={folderUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800">
                <FolderOpen className="h-3.5 w-3.5" /> Buka folder konten di Drive
              </a>
            ) : null}
          </div>
        </CollapsibleContent>
      </div>

      <AlertDialog open={pending !== null} onOpenChange={(o) => !o && !busy && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Jadikan v{pending?.version.version_no} aktif?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                {!pending?.approved ? (
                  <p>Link konten diganti ke v{pending?.version.version_no}. Status produksi menjadi Need Review, sama seperti menempel link baru.</p>
                ) : pending.schedules.length > 0 ? (
                  <>
                    <p>Konten ini sudah terjadwal tayang dengan versi yang aktif sekarang:</p>
                    <ul className="list-disc pl-5">
                      {pending.schedules.map((s) => (
                        <li key={`${s.platform}-${s.scheduled_at}`}>
                          {platformLabel(s.platform)} · {dateFmt.format(new Date(s.scheduled_at))}
                        </li>
                      ))}
                    </ul>
                    <p>Pindahkan jadwalnya ke v{pending.version.version_no}? Tanggal dan jamnya tetap sama.</p>
                  </>
                ) : (
                  <p>Produksi tetap di-approve. Belum ada jadwal tayang untuk konten ini.</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Batal</AlertDialogCancel>
            {pending?.approved && pending.schedules.length > 0 ? (
              <>
                <Button type="button" variant="outline" disabled={busy} onClick={() => void confirmActivate(false)}>
                  Ganti, batalkan jadwal
                </Button>
                <Button type="button" disabled={busy} onClick={() => void confirmActivate(true)}>
                  {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                  Pindahkan jadwal ke v{pending.version.version_no}
                </Button>
              </>
            ) : (
              <Button type="button" disabled={busy} onClick={() => void confirmActivate(false)}>
                {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                Jadikan aktif
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Collapsible>
  );
}
