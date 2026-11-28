/**
 * App-wide strip when the active organization has 50 MB or less of storage left, or is full (uploads refused).
 * The warning can be closed for the day; the "full" strip stays until there is room again.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { HardDrive, X } from "lucide-react";
import { formatStorageBytes, useStorageUsage } from "./storageUsage";

const CLOSED_KEY = "synckerja.storageQuota.warningClosedOn";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function readClosed(): string | null {
  try {
    return window.localStorage.getItem(CLOSED_KEY);
  } catch {
    return null;
  }
}

export function StorageQuotaBanner({ className = "" }: { className?: string }) {
  const usage = useStorageUsage();
  const [closedOn, setClosedOn] = useState<string | null>(() => readClosed());
  const data = usage.data;

  if (!data || data.status === "ok") return null;
  if (data.status === "warning" && closedOn === today()) return null;

  const full = data.status === "full";
  const close = () => {
    try {
      window.localStorage.setItem(CLOSED_KEY, today());
    } catch {
      /* ignore */
    }
    setClosedOn(today());
  };

  return (
    <div
      role="alert"
      className={`flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-2 text-sm ${
        full ? "border-red-200 bg-red-50 text-red-900" : "border-amber-200 bg-amber-50 text-amber-900"
      } ${className}`}
    >
      <HardDrive className={`h-4 w-4 shrink-0 ${full ? "text-red-600" : "text-amber-600"}`} aria-hidden />
      <p className="min-w-0 flex-1">
        {full ? (
          <>
            <b>Penyimpanan penuh</b> ({formatStorageBytes(data.used_bytes)} dari {formatStorageBytes(data.quota_bytes)}). Upload file baru
            diblokir sampai ada ruang.
          </>
        ) : (
          <>
            <b>Penyimpanan hampir penuh.</b> Sisa {formatStorageBytes(data.remaining_bytes)} dari {formatStorageBytes(data.quota_bytes)}. Upload
            akan diblokir saat penuh.
          </>
        )}
      </p>
      <Link
        to="/subscription/overview"
        className={`shrink-0 rounded-md px-3 py-1 font-medium text-white ${full ? "bg-red-600 hover:bg-red-700" : "bg-amber-600 hover:bg-amber-700"}`}
      >
        Lihat pemakaian
      </Link>
      {!full && (
        <button
          type="button"
          onClick={close}
          aria-label="Tutup peringatan penyimpanan untuk hari ini"
          className="shrink-0 rounded p-1 text-amber-700 hover:bg-amber-100"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
