import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Check, Copy, MessageSquare } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";
import { useOrgDriveSettings } from "@/6-1-dashboard/org-drive/useOrgDrive";
import { orgDriveErrorText } from "@/6-1-dashboard/org-drive/orgDriveApi";
import {
  aiConnectSteps,
  mcpConnectorUrl,
  mcpUploadHost,
  relativeIdTime,
  type AiStepState,
} from "@/6-1-dashboard/org-drive/aiConnect";

type Props = {
  organizationId: string | null | undefined;
  onOpenDriveSettings: () => void;
};

function StatusPill({ state, children }: { state: AiStepState; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex flex-shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        state === "done" ? "bg-success-muted text-success-foreground" : "bg-warning-muted text-warning-foreground",
      )}
    >
      {state === "done" ? <Check className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
      {children}
    </span>
  );
}

function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-3 py-2 font-mono text-xs">{value}</code>
      <Button type="button" variant="outline" size="sm" onClick={copy}>
        {copied ? <Check className="mr-1 h-3.5 w-3.5" /> : <Copy className="mr-1 h-3.5 w-3.5" />}
        {copied ? "Tersalin" : "Salin"}
      </Button>
    </div>
  );
}

function Step({
  title,
  state,
  status,
  children,
}: {
  title: string;
  state: AiStepState;
  status: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "space-y-2 rounded-md border bg-card p-4",
        state === "done" ? "border-border" : "border-warning/50",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium">{title}</p>
        <StatusPill state={state}>{status}</StatusPill>
      </div>
      {children}
    </div>
  );
}

export function AiConnectSection({ organizationId, onOpenDriveSettings }: Props) {
  const { data, isPending, error } = useOrgDriveSettings(organizationId);

  if (isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (error || !data) {
    return <p className="text-sm text-destructive">{orgDriveErrorText(error) || "Halaman ini belum bisa dimuat."}</p>;
  }

  const lastToolCallAt = data.ai?.lastToolCallAt ?? null;
  const lastUploadAt = data.ai?.lastUploadAt ?? null;
  const steps = aiConnectSteps({ driveConnected: data.connected, lastToolCallAt, lastUploadAt });
  const lastSeen = lastToolCallAt ?? lastUploadAt;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-base font-medium">Hubungkan AI ke Synckerja</p>
        <p className="text-sm text-muted-foreground">
          Biar Claude, ChatGPT, atau AI lain bisa membaca brief dan mengunggah video langsung ke content plan. Cukup
          sekali, 3 langkah.
        </p>
      </div>

      <Step
        title="1. Tambahkan connector Synckerja di AI kamu"
        state={steps.connector}
        status={steps.connector === "done" && lastSeen ? `Dipakai ${relativeIdTime(lastSeen)}` : "Belum pernah dipakai"}
      >
        <p className="text-sm text-muted-foreground">
          Buka pengaturan connector di AI kamu, tambahkan alamat ini, lalu login dengan akun Synckerja dan pilih org ini.
          Setiap karyawan melakukannya sendiri di AI masing-masing.
        </p>
        <CopyField value={mcpConnectorUrl()} />
        <p className="text-xs text-muted-foreground">
          Claude: Settings → Connectors → Add custom connector. ChatGPT: Settings → Connectors. Lihat dan cabut AI yang
          tersambung di{" "}
          <Link className="underline" to="/settings/security">
            Pengaturan keamanan
          </Link>
          .
        </p>
      </Step>

      <Step
        title="2. Sambungkan Google Drive org"
        state={steps.drive}
        status={steps.drive === "done" ? data.accountEmail ?? "Tersambung" : "Belum tersambung"}
      >
        <p className="text-sm text-muted-foreground">
          Gudang tempat semua video org disimpan. Cukup owner atau admin, sekali untuk semua karyawan dan AI.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={onOpenDriveSettings}>
          Buka pengaturan Google Drive
        </Button>
      </Step>

      <Step
        title="3. Izinkan AI mengirim file ke Synckerja"
        state={steps.upload}
        status={steps.upload === "done" && lastUploadAt ? `Upload terakhir ${relativeIdTime(lastUploadAt)}` : "Belum pernah upload"}
      >
        <p className="text-sm text-muted-foreground">
          Beberapa AI memblokir internet secara default, jadi video hasil render tidak bisa terkirim. Tambahkan domain ini
          ke daftar situs yang diizinkan:
        </p>
        <CopyField value={mcpUploadHost()} />
        <p className="text-xs text-muted-foreground">
          Claude: Settings → Capabilities → Allowed websites. Status ini berubah hijau setelah AI berhasil mengunggah
          video pertama.
        </p>
      </Step>

      <div className="flex items-start gap-2 rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
        <MessageSquare className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <p>
          Coba suruh AI kamu: <span className="text-foreground">"Upload video ini ke content plan [judul] di Synckerja"</span>.
          Kalau ada yang kurang, AI akan dapat petunjuk langkah berikutnya dari Synckerja.
        </p>
      </div>
    </div>
  );
}
