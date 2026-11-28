import { useOrgBootstrapPending } from "@/shared/auth/hooks/useOrgBootstrapPending";
import { CaptionClaimWarning } from "@/6-1-scheduled-posts/components/CaptionClaimWarning";
import type { VoiceOverScript } from "@/thinking-lab/execution/script";

/** Claims in an Execution's narration and caption that are not approved in the Daftar Klaim. */
export function ScriptClaimWarning({ script }: { script: Pick<VoiceOverScript, "scenes" | "caption"> }) {
  const { organizationId } = useOrgBootstrapPending();
  if (!organizationId) return null;
  const text = [...script.scenes.flatMap((scene) => scene.lines.map((line) => line.narration)), script.caption ?? ""]
    .filter((line) => line && line.trim())
    .join("\n");
  if (!text) return null;
  return (
    <CaptionClaimWarning
      organizationId={organizationId}
      caption={text}
      title="Cek klaim di naskah"
      footer="Klaim yang belum disetujui boleh untuk brainstorming, tapi harus disetujui atau dihapus sebelum jadi brief. Tambah klaim di Content Studio → Klaim."
    />
  );
}
