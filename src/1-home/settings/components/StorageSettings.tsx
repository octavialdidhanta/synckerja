/** Settings → Storage: the organization's storage against its quota. Open to every tenant (self-service and sales). */
import { StorageUsageCard } from "@/shared/storage/StorageUsageCard";

export function StorageSettings() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Penyimpanan organisasi</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Total file semua modul (footage, chat pelanggan, konten, task, keuangan, karyawan) dibanding kuota organisasi. Saat penuh,
          upload file baru diblokir sampai ada ruang. Angka diperbarui tiap 10 menit.
        </p>
      </div>
      <StorageUsageCard />
    </div>
  );
}
