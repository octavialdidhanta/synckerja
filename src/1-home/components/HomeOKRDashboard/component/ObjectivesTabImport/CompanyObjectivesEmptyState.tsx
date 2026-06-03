import { Target, Plus, Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";

type CompanyObjectivesEmptyStateProps = {
  onAddClick?: () => void;
  /** Tampilkan teks LCP segera; tombol nonaktif sampai data siap. */
  pending?: boolean;
};

/**
 * Empty state company objectives — elemen LCP Lighthouse (paragraf deskripsi).
 * Dipakai saat loading (pending) dan saat daftar kosong agar LCP tidak menunggu fetch selesai.
 */
export function CompanyObjectivesEmptyState({
  onAddClick,
  pending = false,
}: CompanyObjectivesEmptyStateProps) {
  return (
    <div
      className="relative flex h-full min-h-[min(400px,50vh)] w-full min-w-0 flex-1 flex-col items-center justify-center overflow-hidden rounded-lg bg-gray-50 p-6 text-center dark:bg-muted/30"
      aria-busy={pending || undefined}
    >
      <div className="mb-4 flex justify-center">
        {pending ? (
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
        ) : (
          <Target className="h-8 w-8 text-gray-400 dark:text-muted-foreground" aria-hidden />
        )}
      </div>
      <h3 className="mb-2 text-lg font-medium text-gray-900 dark:text-foreground">
        No Company Objectives Found
      </h3>
      <p className="mb-6 max-w-md text-center text-sm text-gray-600 dark:text-muted-foreground">
        Create company objectives to align your organization&apos;s strategic goals.
      </p>
      <Button
        type="button"
        onClick={onAddClick}
        size="sm"
        className="gap-2"
        disabled={pending || !onAddClick}
      >
        <Plus className="h-4 w-4" aria-hidden />
        Add Objective
      </Button>
    </div>
  );
}
