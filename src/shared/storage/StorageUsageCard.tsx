/** Storage used by the active organization against its quota, with the largest modules. */
import { Link } from "react-router-dom";
import { HardDrive } from "lucide-react";
import { Card } from "@/shared/components/ui/card";
import { cn } from "@/shared/lib/utils";
import { useSubscriptionSelfServiceEnabled } from "@/shared/auth/hooks/useSubscriptionSelfServiceEnabled";
import {
  formatStorageBytes,
  groupStorageByModule,
  storageUsedPercent,
  useStorageUsage,
  type StorageUsageStatus,
} from "./storageUsage";

const BAR: Record<StorageUsageStatus, string> = {
  ok: "bg-primary",
  warning: "bg-amber-500",
  full: "bg-red-600",
};

export function StorageUsageCard({ compact = false, className }: { compact?: boolean; className?: string }) {
  const usage = useStorageUsage();
  // Sales tenants have no Subscription menu: their quota changes through the sales team.
  const selfService = useSubscriptionSelfServiceEnabled();

  if (usage.isPending) {
    return (
      <Card className={cn("p-4", className)}>
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="mt-3 h-2 w-full animate-pulse rounded-full bg-muted" />
        <div className="mt-2 h-3 w-48 animate-pulse rounded bg-muted" />
      </Card>
    );
  }
  if (usage.isError || !usage.data) {
    return (
      <Card className={cn("p-4 text-sm text-muted-foreground", className)}>
        Pemakaian penyimpanan belum bisa dimuat. Coba muat ulang halaman.
      </Card>
    );
  }

  const data = usage.data;
  const percent = storageUsedPercent(data);
  const modules = groupStorageByModule(data.by_bucket).filter((m) => m.bytes > 0);

  return (
    <Card className={cn("p-4", className)}>
      <div className="mb-3 flex items-center gap-3">
        <HardDrive className="h-5 w-5 text-primary" aria-hidden />
        <h4 className="font-medium text-foreground">Penyimpanan</h4>
      </div>
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span className="font-medium text-foreground">
            {formatStorageBytes(data.used_bytes)} <span className="font-normal text-muted-foreground">dari {formatStorageBytes(data.quota_bytes)}</span>
          </span>
          <span className="text-xs text-muted-foreground">{percent.toLocaleString("id-ID")}%</span>
        </div>
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label="Pemakaian penyimpanan"
        >
          <div className={cn("h-2 rounded-full", BAR[data.status])} style={{ width: `${Math.max(percent, data.used_bytes > 0 ? 1 : 0)}%` }} />
        </div>
        <p
          className={cn(
            "text-xs",
            data.status === "full" ? "font-medium text-red-700" : data.status === "warning" ? "font-medium text-amber-700" : "text-muted-foreground",
          )}
        >
          {data.status === "full"
            ? "Penyimpanan penuh. Upload file baru diblokir sampai ada ruang."
            : data.status === "warning"
              ? `Sisa ${formatStorageBytes(data.remaining_bytes)}. Upload diblokir saat penuh.`
              : `Sisa ${formatStorageBytes(data.remaining_bytes)} · ${data.file_count.toLocaleString("id-ID")} file · diperbarui tiap 10 menit`}
        </p>
        {data.status !== "ok" &&
          (selfService ? (
            <Link to="/subscription/plans" className="inline-block text-xs font-medium text-primary underline underline-offset-2">
              Lihat paket untuk menambah kuota
            </Link>
          ) : (
            <p className="text-xs text-muted-foreground">Hubungi tim sales Synckerja untuk menambah kuota.</p>
          ))}
      </div>

      {!compact && modules.length > 0 && (
        <ul className="mt-4 space-y-2">
          {modules.map((m) => {
            const share = data.used_bytes ? Math.round((m.bytes / data.used_bytes) * 100) : 0;
            return (
              <li key={m.key} className="text-xs">
                <div className="flex justify-between gap-2">
                  <span className="text-foreground">{m.label}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {formatStorageBytes(m.bytes)} · {m.files.toLocaleString("id-ID")} file
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-1.5 rounded-full bg-primary/60" style={{ width: `${Math.max(share, 1)}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
