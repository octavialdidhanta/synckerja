import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { useOrgDriveSettings } from "@/6-1-dashboard/org-drive/useOrgDrive";
import { orgDriveErrorText } from "@/6-1-dashboard/org-drive/orgDriveApi";

type Props = { organizationId: string | null | undefined };

const OAUTH_ERROR_TEXT: Record<string, string> = {
  access_denied: "Izin ke Google Drive dibatalkan.",
  drive_permission_not_granted: "Centang izin Google Drive di layar Google, lalu coba lagi.",
  forbidden: "Hanya owner atau admin yang bisa menyambungkan.",
  state_expired: "Waktu login habis. Coba lagi.",
};

export function GoogleDriveOrgSection({ organizationId }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, isPending, error, connect, disconnect } = useOrgDriveSettings(organizationId);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  useEffect(() => {
    const connected = searchParams.get("drive_connected");
    const oauthError = searchParams.get("drive_oauth_error");
    if (connected === "1") toast.success("Google Drive org tersambung.");
    if (oauthError) toast.error(OAUTH_ERROR_TEXT[oauthError] ?? `Google menolak sambungan: ${oauthError}`);
    if (connected || oauthError) {
      const next = new URLSearchParams(searchParams);
      next.delete("drive_connected");
      next.delete("drive_oauth_error");
      next.set("section", "google-drive");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  if (isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-10 w-48" />
      </div>
    );
  }

  if (error || !data) {
    return <p className="text-sm text-destructive">{orgDriveErrorText(error) || "Pengaturan belum bisa dimuat."}</p>;
  }

  const serverReady = data.oauthConfigured !== false && data.encryptionReady !== false;

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-md border border-border bg-muted/30 p-4">
        <p className="text-sm font-medium">Google Drive org</p>
        <p className="text-sm text-muted-foreground">
          Semua video konten org ini disimpan di satu Google Drive. Karyawan dan AI mengunggah lewat Synckerja, jadi
          mereka tidak perlu menyambungkan Drive masing-masing.
        </p>
        {data.connected ? (
          <div className="space-y-1 pt-1">
            <p className="text-sm">
              <span className="mr-2 inline-flex items-center rounded-full bg-success-muted px-2 py-0.5 text-xs font-medium text-success-foreground">
                Tersambung
              </span>
              <span className="font-medium">{data.accountEmail ?? "Akun Google"}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Folder:{" "}
              {data.rootFolderUrl ? (
                <a className="inline-flex items-center gap-1 underline" href={data.rootFolderUrl} target="_blank" rel="noreferrer">
                  {data.rootFolderName}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                data.rootFolderName
              )}
            </p>
          </div>
        ) : (
          <p className="pt-1 text-sm text-muted-foreground">Belum tersambung.</p>
        )}
        {data.lastError ? <p className="text-xs text-destructive">{data.lastError}</p> : null}
        <p className="text-xs text-muted-foreground">
          Synckerja hanya bisa membuka file dan folder yang dibuatnya sendiri. Isi Drive yang lain tidak terlihat.
        </p>
      </div>

      {data.canManage && !serverReady ? (
        <div className="space-y-1 rounded-md border border-border p-4 text-sm text-muted-foreground">
          <p>Server belum siap: Google OAuth atau kunci enkripsi token belum diatur.</p>
        </div>
      ) : null}

      {data.canManage && data.redirectUri ? (
        <div className="space-y-1 rounded-md border border-border p-4">
          <p className="text-xs font-medium text-foreground">Redirect URL (daftarkan sekali di Google Cloud Console)</p>
          <p className="break-all font-mono text-xs text-muted-foreground">{data.redirectUri}</p>
        </div>
      ) : null}

      {data.canManage ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={data.connected ? "secondary" : "default"}
            disabled={!serverReady || connect.isPending || !organizationId}
            onClick={() =>
              connect.mutate(undefined, { onError: (e) => toast.error(orgDriveErrorText(e)) })
            }
          >
            {connect.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {data.connected ? "Ganti akun" : "Sambungkan Google Drive"}
          </Button>
          {data.connected ? (
            <Button type="button" variant="outline" disabled={disconnect.isPending} onClick={() => setConfirmDisconnect(true)}>
              Putuskan
            </Button>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Hanya owner atau admin yang bisa menyambungkan atau mengganti akun.</p>
      )}

      {data.canManage ? (
        <p className="text-xs text-muted-foreground">
          Saat menyambungkan, pilih akun Google yang menjadi tempat penyimpanan org ini (boleh berbeda dari akun login
          Anda). Mengganti akun hanya berlaku untuk upload berikutnya; video lama tetap di Drive lama.
        </p>
      ) : null}

      <AlertDialog open={confirmDisconnect} onOpenChange={setConfirmDisconnect}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Putuskan Google Drive org?</AlertDialogTitle>
            <AlertDialogDescription>
              Synckerja berhenti mengunggah ke {data.accountEmail ?? "akun ini"}. Video yang sudah ada tidak dihapus dan
              link-nya tetap bisa dibuka.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                disconnect.mutate(undefined, {
                  onSuccess: () => toast.success("Google Drive org diputuskan."),
                  onError: (e) => toast.error(orgDriveErrorText(e)),
                })
              }
            >
              Putuskan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
