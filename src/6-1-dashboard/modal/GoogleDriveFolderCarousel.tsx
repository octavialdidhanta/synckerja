import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, FolderOpen, ChevronLeft, ChevronRight, FileIcon, Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { extractGoogleDriveFolderId } from "../utils/previewUtils";
import { useDriveFolderList } from "../hook/useDriveFolderList";
import { useGoogleDriveFileGrant } from "../hook/useGoogleDriveFileGrant";
import { GoogleDriveFilePreview } from "./GoogleDriveInAppFilePreview";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import {
  GOOGLE_DRIVE_OAUTH_SUCCESS_MESSAGE_TYPE,
  GOOGLE_OAUTH_REFRESH_HINT_KEY,
} from "@/shared/lib/googleDriveOAuth";
import { cn } from "@/shared/lib/utils";

interface GoogleDriveFolderCarouselProps {
  folderUrl: string;
}

function fileViewLink(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view?usp=drive_link`;
}

/** Compact square tile in horizontal strip */
const THUMB = "h-11 w-11 sm:h-12 sm:w-12";

function isTypingTarget(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return Boolean(el.closest("[contenteditable='true']"));
}

const GoogleDriveFolderCarousel: React.FC<GoogleDriveFolderCarouselProps> = ({ folderUrl }) => {
  const { t } = useAppTranslation();
  const rootFolderId = useMemo(() => extractGoogleDriveFolderId(folderUrl), [folderUrl]);
  const [stack, setStack] = useState<string[]>(() => (rootFolderId ? [rootFolderId] : []));
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const activeFolderId = stack.length ? stack[stack.length - 1]! : null;
  const thumbStripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (rootFolderId) {
      setStack([rootFolderId]);
      setSelectedFileId(null);
    } else {
      setStack([]);
      setSelectedFileId(null);
    }
  }, [rootFolderId]);

  const { files, loading, error, grantRequired, reload: reloadFolderList } =
    useDriveFolderList(activeFolderId);
  const { granting, grantDriveResource } = useGoogleDriveFileGrant();

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === GOOGLE_OAUTH_REFRESH_HINT_KEY && e.newValue) {
        reloadFolderList();
      }
    };
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === GOOGLE_DRIVE_OAUTH_SUCCESS_MESSAGE_TYPE) {
        reloadFolderList();
      }
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("message", onMessage);
    };
  }, [reloadFolderList]);

  const navigableFiles = useMemo(() => files.filter((f) => !f.isFolder), [files]);
  const selectedNavIndex = useMemo(
    () => navigableFiles.findIndex((f) => f.id === selectedFileId),
    [navigableFiles, selectedFileId],
  );

  const goPrevNav = useCallback(() => {
    if (selectedNavIndex <= 0) return;
    setSelectedFileId(navigableFiles[selectedNavIndex - 1]!.id);
  }, [navigableFiles, selectedNavIndex]);

  const goNextNav = useCallback(() => {
    if (navigableFiles.length === 0) return;
    if (selectedNavIndex < 0) {
      setSelectedFileId(navigableFiles[0]!.id);
      return;
    }
    if (selectedNavIndex >= navigableFiles.length - 1) return;
    setSelectedFileId(navigableFiles[selectedNavIndex + 1]!.id);
  }, [navigableFiles, selectedNavIndex]);

  useEffect(() => {
    if (navigableFiles.length === 0) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;

      const nextKeys = new Set(["ArrowRight", "ArrowDown", "PageDown"]);
      const prevKeys = new Set(["ArrowLeft", "ArrowUp", "PageUp"]);

      if (nextKeys.has(e.key)) {
        e.preventDefault();
        goNextNav();
        return;
      }
      if (prevKeys.has(e.key)) {
        e.preventDefault();
        goPrevNav();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goNextNav, goPrevNav, navigableFiles.length]);

  useEffect(() => {
    const strip = thumbStripRef.current;
    if (!selectedFileId || !strip) return;
    const thumb = strip.querySelector<HTMLElement>(`[data-file-id="${CSS.escape(selectedFileId)}"]`);
    if (!thumb) return;
    // scrollIntoView() walks scrollable *ancestors* and can move the whole modal — only scroll this strip.
    const thumbCenter = thumb.offsetLeft + thumb.offsetWidth / 2;
    const viewport = strip.clientWidth;
    const maxScroll = Math.max(0, strip.scrollWidth - viewport);
    const target = Math.max(0, Math.min(maxScroll, thumbCenter - viewport / 2));
    strip.scrollTo({ left: target, behavior: "auto" });
  }, [selectedFileId]);

  const selectedLink = selectedFileId ? fileViewLink(selectedFileId) : null;

  const openInDrive = useCallback(() => {
    window.open(folderUrl, "_blank", "noopener,noreferrer");
  }, [folderUrl]);

  const enterFolder = useCallback((id: string) => {
    setStack((s) => [...s, id]);
    setSelectedFileId(null);
  }, []);

  const goBack = useCallback(() => {
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
    setSelectedFileId(null);
  }, []);

  const canPrev = selectedNavIndex > 0;
  const canNext =
    navigableFiles.length > 0 &&
    (selectedNavIndex < 0 || selectedNavIndex < navigableFiles.length - 1);

  if (!rootFolderId) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50">
        <p className="text-sm text-gray-600">{t("googleDriveFolder.invalidUrl", "Tautan folder tidak valid.")}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col gap-1.5 rounded-lg border border-gray-200 bg-white p-2">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <div className="flex min-w-0 min-h-7 items-center gap-1.5">
          <FolderOpen className="h-4 w-4 shrink-0 text-blue-600" />
          <span className="truncate text-xs font-medium text-gray-900 sm:text-sm">
            {t("googleDriveFolder.title", "Folder Google Drive")}
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5 sm:flex-nowrap">
          {navigableFiles.length > 0 ? (
            <div
              className="flex items-center gap-0.5 rounded-md border border-gray-200 bg-white px-0.5 py-0.5"
              title={t(
                "googleDriveFolder.keyboardNavHint",
                "Keyboard: ← → atau ↑ ↓ untuk file sebelumnya/berikutnya (bukan saat mengetik).",
              )}
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 w-7 shrink-0 border-0 p-0 shadow-none hover:bg-gray-100"
                disabled={!canPrev}
                title={t("googleDriveFolder.previousFile", "File sebelumnya")}
                aria-label={t("googleDriveFolder.previousFile", "File sebelumnya")}
                onClick={goPrevNav}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[2.75rem] text-center text-[11px] font-medium tabular-nums text-blue-700">
                {selectedNavIndex >= 0
                  ? t("googleDriveFolder.filePosition", "{{current}} / {{total}}", {
                      current: selectedNavIndex + 1,
                      total: navigableFiles.length,
                    })
                  : "—"}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 w-7 shrink-0 border-0 p-0 shadow-none hover:bg-gray-100"
                disabled={!canNext}
                title={t("googleDriveFolder.nextFile", "File berikutnya")}
                aria-label={t("googleDriveFolder.nextFile", "File berikutnya")}
                onClick={goNextNav}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          ) : null}
          <Button type="button" variant="outline" size="sm" className="h-7 shrink-0 px-2 text-xs" onClick={openInDrive}>
            <ExternalLink className="h-3.5 w-3.5 sm:mr-1" />
            <span className="hidden sm:inline">{t("googleDriveFolder.openInDrive", "Buka di Drive")}</span>
          </Button>
        </div>
      </div>

      {error ? (
        <div className="shrink-0 rounded border border-amber-200 bg-amber-50/90 p-2 text-xs text-amber-900">
          <p className="mb-1.5 font-medium">{error}</p>
          {grantRequired && activeFolderId ? (
            <div className="mb-2 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="default"
                size="sm"
                className="h-7 text-xs"
                disabled={granting}
                onClick={() =>
                  void grantDriveResource(activeFolderId, {
                    isFolder: true,
                    onGranted: reloadFolderList,
                  })
                }
              >
                {granting
                  ? t("googleDrivePreview.grantInProgress", "Membuka Google Picker…")
                  : t("googleDrivePreview.grantFolderAccess", "Izinkan akses folder")}
              </Button>
            </div>
          ) : (
            <p className="mb-2 text-amber-800/90">
              {t(
                "googleDriveFolder.connectViaPreviewHeader",
                "Hubungkan atau putuskan Google memakai tombol di baris judul Preview di atas. Setelah menghubungkan lagi, daftar folder akan dimuat ulang otomatis.",
              )}
            </p>
          )}
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={openInDrive}>
            {t("googleDriveFolder.openInDrive", "Buka di Drive")}
          </Button>
        </div>
      ) : null}

      <div
        className="flex min-h-0 min-w-0 flex-1 flex-col basis-0 overflow-hidden rounded border border-gray-100 bg-neutral-50"
        aria-label={t("googleDriveFolder.previewPane", "Pratinjau di aplikasi")}
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-0">
          {selectedLink ? (
            <GoogleDriveFilePreview link={selectedLink} className="min-h-0 flex-1" />
          ) : (
            <div className="flex min-h-0 flex-1 items-center justify-center px-2 text-center text-xs text-gray-500">
              {t(
                "googleDriveFolder.selectFile",
                "Pilih file di daftar untuk pratinjau (video/gambar) di sini.",
              )}
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 rounded border border-gray-100 bg-gray-50/80 px-0.5 py-0.5">
        <p className="px-1 pb-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
          {t("googleDriveFolder.fileList", "Isi folder")}
        </p>
        <div
          ref={thumbStripRef}
          className="drive-folder-thumb-strip-scroll flex max-h-[4.5rem] gap-0.5 overflow-x-auto overflow-y-hidden py-0.5"
          role="list"
        >
          {stack.length > 1 ? (
            <button
              type="button"
              onClick={goBack}
              title={t("googleDriveFolder.back", "Kembali")}
              className={cn(
                "flex shrink-0 flex-col items-center justify-center rounded border border-gray-200 bg-white",
                "text-gray-600 hover:bg-blue-50 hover:border-blue-200",
                THUMB,
              )}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : null}

          {loading ? (
            <div className="flex items-center gap-1.5 px-2 py-2 text-gray-500">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              <span className="whitespace-nowrap text-xs">{t("googleDriveFolder.loading", "Memuat…")}</span>
            </div>
          ) : files.length === 0 ? (
            <p className="px-2 py-2 text-xs text-gray-500">{t("googleDriveFolder.empty", "Folder kosong atau tidak ada akses.")}</p>
          ) : (
            files.map((f) => {
              const thumb = f.thumbnailLink ?? f.fallbackThumbnailUrl ?? f.iconLink ?? undefined;
              if (f.isFolder) {
                return (
                  <button
                    key={f.id}
                    type="button"
                    role="listitem"
                    title={f.name}
                    onClick={() => enterFolder(f.id)}
                    className={cn(
                      "flex w-[3.25rem] shrink-0 flex-col items-center justify-center gap-0 rounded border border-gray-200 bg-white px-0.5 py-0.5 sm:w-14",
                      "hover:border-blue-300 hover:bg-blue-50/90",
                    )}
                  >
                    <FolderOpen className="h-5 w-5 text-blue-500 sm:h-6 sm:w-6" />
                    <span className="line-clamp-2 w-full break-all text-center text-[9px] leading-[1.05] text-gray-800">
                      {f.name}
                    </span>
                  </button>
                );
              }
              return (
                <button
                  key={f.id}
                  type="button"
                  role="listitem"
                  data-file-id={f.id}
                  title={f.name}
                  onClick={() => setSelectedFileId(f.id)}
                  className={cn(
                    "relative shrink-0 overflow-hidden rounded border bg-gray-100 p-0 transition-shadow",
                    THUMB,
                    selectedFileId === f.id
                      ? "border-blue-500 ring-2 ring-blue-400 ring-offset-1"
                      : "border-gray-200 hover:border-gray-300",
                  )}
                >
                  {thumb ? (
                    <img
                      src={thumb}
                      alt=""
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center">
                      <FileIcon className="h-6 w-6 text-gray-400" />
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default GoogleDriveFolderCarousel;
