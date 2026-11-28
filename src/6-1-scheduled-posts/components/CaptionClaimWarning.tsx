import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/shared/lib/supabaseClient";
import { useClaims } from "@/6-1-content-studio/claims/useClaims";
import type { RegistryClaim } from "@/shared/claims/claimMatch";
import { checkCaptionClaims, gayaClaimWords, type CaptionClaimStatus } from "../lib/captionClaims";

// Catalog tables are newer than the generated Supabase types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

const LABEL: Record<CaptionClaimStatus, string> = {
  terdaftar: "terdaftar",
  perlu_bukti: "perlu bukti",
  ditolak: "ditolak",
  tidak_terdaftar: "tidak terdaftar",
};

/** Industry template claim words plus the organization's own "Kata klaim:" lines from Gaya baku. */
function useOrgClaimWords(organizationId: string) {
  return useQuery<string[]>({
    queryKey: ["caption-claim-words", organizationId],
    enabled: Boolean(organizationId),
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const [settings, style] = await Promise.all([
        db.from("organization_catalog_settings").select("industry_template_code").eq("organization_id", organizationId).maybeSingle(),
        db.from("catalog_style_fields").select("field_key,body").eq("organization_id", organizationId),
      ]);
      const words: string[] = [];
      const code = settings.data?.industry_template_code as string | undefined;
      if (code) {
        const tpl = await db.from("catalog_industry_templates").select("claim_words").eq("code", code).maybeSingle();
        words.push(...((tpl.data?.claim_words as string[] | undefined) ?? []));
      }
      const boxes = Object.fromEntries(((style.data ?? []) as { field_key: string; body: string }[]).map((r) => [r.field_key, r.body]));
      words.push(...gayaClaimWords(boxes));
      return words;
    },
  });
}

/**
 * Last guard before posting: caption claims that are not backed by an approved claim in the Daftar Klaim.
 * Shows nothing when every claim is approved. Never blocks scheduling.
 */
export function CaptionClaimWarning({ organizationId, caption }: { organizationId: string; caption: string }) {
  const claims = useClaims();
  const words = useOrgClaimWords(organizationId);
  const findings = useMemo(() => {
    if (!caption.trim() || !claims.data) return [];
    const registry: RegistryClaim[] = claims.data.map((c) => ({
      code: c.code,
      text: c.text,
      status: c.status,
      scopes: c.scopes.map((s) => ({ scope: s.scope, product: s.targetId ?? undefined })),
    }));
    return checkCaptionClaims(caption, registry, words.data ?? []);
  }, [caption, claims.data, words.data]);
  const warn = findings.filter((f) => f.status !== "terdaftar");
  if (!warn.length) return null;
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900" role="status">
      <div className="font-medium">Cek klaim caption sebelum tayang</div>
      <ul className="mt-1 list-disc space-y-0.5 pl-4">
        {warn.map((f) => (
          <li key={f.claim}>
            <b>{f.claim}</b> — {LABEL[f.status]}
            {f.code ? ` (${f.code})` : ""}
            {f.status === "ditolak" ? ": hapus dari caption." : f.status === "perlu_bukti" ? ": belum disetujui owner/admin." : ": belum ada di Daftar Klaim."}
          </li>
        ))}
      </ul>
      <div className="mt-1 text-amber-800">Hanya klaim disetujui yang boleh disebut. Kelola di Content Studio → Klaim. Peringatan ini tidak memblokir jadwal.</div>
    </div>
  );
}
