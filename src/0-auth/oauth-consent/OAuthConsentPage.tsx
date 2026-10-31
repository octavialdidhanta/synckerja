import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AuthSplitLayout } from "@/0-auth/components/AuthSplitLayout";
import { authFormSubtitleClass, authFormTitleClass } from "@/0-auth/styles/authFormStyles";
import { useAuth } from "@/shared/auth/contexts/AuthContext";
import { Button } from "@/shared/components/ui/button";
import { useAppTranslation } from "@/shared/i18n/useAppTranslation";
import { supabase } from "@/shared/lib/supabaseClient";

const MCP_PUBLIC_URL = String(import.meta.env.VITE_MCP_PUBLIC_URL || "http://localhost:8787").replace(
  /\/+$/,
  "",
);

type OrgChoice = {
  id: string;
  name: string;
};

function orgName(value: { company_name?: string } | { company_name?: string }[] | null): string {
  if (!value) return "";
  if (Array.isArray(value)) return value[0]?.company_name || "";
  return value.company_name || "";
}

export function OAuthConsentPage() {
  const { t } = useAppTranslation();
  const { user, session, loading } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const requestId = params.get("request") || "";
  const [orgs, setOrgs] = useState<OrgChoice[]>([]);
  const [selected, setSelected] = useState("");
  const [orgsLoading, setOrgsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || user) return;
    const next = requestId ? `/oauth/consent?request=${encodeURIComponent(requestId)}` : "/oauth/consent";
    navigate(`/login?redirectTo=${encodeURIComponent(next)}`, { replace: true });
  }, [loading, user, requestId, navigate]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setOrgsLoading(true);
    void supabase
      .from("user_organizations")
      .select("organization_id, organizations(company_name)")
      .eq("user_id", user.id)
      .or("is_active.is.null,is_active.eq.true")
      .then(({ data, error: queryError }) => {
        if (cancelled) return;
        if (queryError) {
          setError(queryError.message);
          setOrgsLoading(false);
          return;
        }
        const choices = (data ?? []).map((row) => ({
          id: row.organization_id,
          name:
            orgName(row.organizations as { company_name?: string } | { company_name?: string }[] | null) ||
            row.organization_id,
        }));
        setOrgs(choices);
        setSelected((current) => current || choices[0]?.id || "");
        setOrgsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function submit() {
    if (!session?.access_token || !requestId || !selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`${MCP_PUBLIC_URL}/oauth/consent`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ request_id: requestId, organization_id: selected }),
      });
      const body = (await response.json().catch(() => null)) as { redirect_url?: string; error_description?: string } | null;
      if (!response.ok || !body?.redirect_url) {
        setError(body?.error_description || t("auth.oauthConsent.failed", "Tidak bisa menghubungkan connector."));
        setSubmitting(false);
        return;
      }
      window.location.assign(body.redirect_url);
    } catch {
      setError(t("auth.oauthConsent.failed", "Tidak bisa menghubungkan connector."));
      setSubmitting(false);
    }
  }

  return (
    <AuthSplitLayout>
      <div className="flex w-full flex-col gap-4">
        <div>
          <h1 className={authFormTitleClass}>{t("auth.oauthConsent.title", "Hubungkan Claude")}</h1>
          <p className={authFormSubtitleClass}>
            {t(
              "auth.oauthConsent.subtitle",
              "Pilih organisasi untuk sesi ini. Organisasi aktif di browser tidak berubah.",
            )}
          </p>
        </div>
        {!requestId ? (
          <p className="text-sm text-destructive">
            {t("auth.oauthConsent.missingRequest", "Permintaan otorisasi tidak ditemukan.")}
          </p>
        ) : null}
        {loading || orgsLoading ? (
          <div className="flex flex-col gap-2" aria-busy="true">
            <span className="sr-only">{t("auth.oauthConsent.loading", "Memuat organisasi")}</span>
            <div className="h-11 animate-pulse rounded-md bg-slate-100" />
            <div className="h-11 animate-pulse rounded-md bg-slate-100" />
          </div>
        ) : (
          <fieldset className="flex flex-col gap-2" disabled={submitting}>
            <legend className="sr-only">{t("auth.oauthConsent.orgLegend", "Organisasi")}</legend>
            {orgs.map((org) => (
              <label
                key={org.id}
                className="flex cursor-pointer items-center gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm"
              >
                <input
                  type="radio"
                  name="organization"
                  value={org.id}
                  checked={selected === org.id}
                  onChange={() => setSelected(org.id)}
                />
                <span>{org.name}</span>
              </label>
            ))}
            {orgs.length === 0 ? (
              <p className="text-sm text-slate-600">
                {t("auth.oauthConsent.noOrg", "Akun ini belum punya organisasi aktif.")}
              </p>
            ) : null}
          </fieldset>
        )}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="button" disabled={!requestId || !selected || submitting || loading} onClick={() => void submit()}>
          {t("auth.oauthConsent.continue", "Lanjutkan")}
        </Button>
      </div>
    </AuthSplitLayout>
  );
}
