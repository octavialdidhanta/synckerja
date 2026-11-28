/**
 * Storage used by the active organization against its quota (RPC get_storage_usage, migration 20261128140000).
 * Quota: Start Up 2 GB, Scale Up 10 GB, Enterprise 50 GB, sales tenants 5 GB. Uploads are refused at 100%;
 * the Office warns when 50 MB or less is left.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";

export type StorageUsageStatus = "ok" | "warning" | "full";

export interface StorageUsage {
  organization_id: string;
  used_bytes: number;
  quota_bytes: number;
  remaining_bytes: number;
  file_count: number;
  by_bucket: Array<{ bucket: string; bytes: number; files: number }>;
  status: StorageUsageStatus;
  warn_remaining_bytes: number;
  updated_at: string | null;
}

export interface StorageModuleUsage {
  key: string;
  label: string;
  bytes: number;
  files: number;
}

const MODULES: Array<{ key: string; label: string; buckets: string[] }> = [
  { key: "footage", label: "Footage & katalog konten", buckets: ["catalog-media"] },
  { key: "chat", label: "Chat pelanggan (WA, IG, FB)", buckets: ["whatsapp-media"] },
  {
    key: "content",
    label: "Konten & brief",
    buckets: [
      "brief-visual-images",
      "social-media-carousel",
      "social-media-story",
      "digital-asset-character-images",
      "digital-asset-company-logos",
      "lead-magnet-assets",
      "kol-profile-photos",
      "ai-employee-references",
    ],
  },
  { key: "task", label: "Task & lampiran", buckets: ["task-files", "sniping-images"] },
  {
    key: "finance",
    label: "Keuangan & struk",
    buckets: ["expense-receipts", "income-receipts", "debt-payment-receipts", "purchase-documents", "sales-receipts", "invoice-template-logos"],
  },
  { key: "people", label: "Karyawan & absensi", buckets: ["employee-profiles", "employee-documents", "attendance-photos"] },
  { key: "recruitment", label: "Rekrutmen", buckets: ["recruitment-files"] },
  { key: "products", label: "Produk & outlet", buckets: ["catalog-product-photos", "outlet-receipt-assets", "sub-service-photos"] },
];

/** Buckets grouped into modules the owner recognises, largest first; unknown buckets go to "Lainnya". */
export function groupStorageByModule(byBucket: StorageUsage["by_bucket"]): StorageModuleUsage[] {
  const out = new Map<string, StorageModuleUsage>();
  for (const row of byBucket ?? []) {
    const mod = MODULES.find((m) => m.buckets.includes(row.bucket));
    const key = mod?.key ?? "other";
    const current = out.get(key) ?? { key, label: mod?.label ?? "Lainnya", bytes: 0, files: 0 };
    current.bytes += Number(row.bytes) || 0;
    current.files += Number(row.files) || 0;
    out.set(key, current);
  }
  return [...out.values()].sort((a, b) => b.bytes - a.bytes);
}

export function formatStorageBytes(bytes: number): string {
  const value = Math.max(0, Number(bytes) || 0);
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(value >= 10 * 1024 ** 3 ? 0 : 1).replace(".", ",")} GB`;
  if (value >= 1024 ** 2) return `${Math.round(value / 1024 ** 2)} MB`;
  if (value >= 1024) return `${Math.round(value / 1024)} KB`;
  return `${value} B`;
}

export function storageUsedPercent(usage: Pick<StorageUsage, "used_bytes" | "quota_bytes">): number {
  if (!usage.quota_bytes) return 0;
  return Math.min(100, Math.round((usage.used_bytes / usage.quota_bytes) * 1000) / 10);
}

export const STORAGE_USAGE_QUERY_KEY = "storage-usage";

export function useStorageUsage(opts: { enabled?: boolean } = {}) {
  const { organizationId } = useOrgBootstrapPending();
  return useQuery<StorageUsage>({
    queryKey: [STORAGE_USAGE_QUERY_KEY, organizationId],
    enabled: Boolean(organizationId) && opts.enabled !== false,
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_storage_usage" as never);
      if (error) throw error;
      return data as unknown as StorageUsage;
    },
  });
}
