import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Copy, Unplug } from "lucide-react";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import { Alert, AlertDescription } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";

type ConnectionRow = {
  user_id: string;
  client_id: string;
  full_name: string | null;
  client_name: string | null;
  connected_at: string;
};

function rowKey(row: { user_id: string; client_id: string }): string {
  return `${row.user_id}:${row.client_id}`;
}

function mcpServerUrl(): string {
  const origin = String(import.meta.env.VITE_MCP_PUBLIC_URL || "https://mcp.synckerja.com").replace(/\/+$/, "");
  return origin.endsWith("/mcp") ? origin : `${origin}/mcp`;
}

function formatWhen(value: string, language: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(language.startsWith("id") ? "id-ID" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function ClaudeSecuritySection({ compact = false }: { compact?: boolean }) {
  const { t, i18n } = useTranslation();
  const { organizationId } = useCurrentOrg();
  const [connections, setConnections] = useState<ConnectionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [revokingKey, setRevokingKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const serverUrl = mcpServerUrl();

  const copyServerUrl = async () => {
    try {
      await navigator.clipboard.writeText(serverUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const load = useCallback(async (orgId: string) => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase.rpc("mcp_list_connections", { p_organization_id: orgId });
    if (error) {
      setLoadError(t("settings.security.claude.loadError"));
      setConnections([]);
    } else {
      setConnections((data ?? []) as ConnectionRow[]);
    }
    setLoading(false);
  }, [t]);

  useEffect(() => {
    if (!organizationId) {
      setConnections([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setLoadError(null);
      const { data, error } = await supabase.rpc("mcp_list_connections", { p_organization_id: organizationId });
      if (cancelled) return;
      if (error) {
        setLoadError(t("settings.security.claude.loadError"));
        setConnections([]);
      } else {
        setConnections((data ?? []) as ConnectionRow[]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [organizationId, t]);

  const revoke = async (row: ConnectionRow) => {
    if (!organizationId) return;
    const key = rowKey(row);
    setRevokingKey(key);
    setRevokeError(null);
    const { error: rpcError } = await supabase.rpc("mcp_revoke_connection", {
      p_organization_id: organizationId,
      p_user_id: row.user_id,
      p_client_id: row.client_id,
    });
    setRevokingKey(null);
    setPendingKey(null);
    if (rpcError) {
      setRevokeError(t("settings.security.claude.revokeError"));
      return;
    }
    await load(organizationId);
  };

  const text = compact ? "text-xs" : "text-sm";

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className={compact ? "p-3 pb-2" : "pb-4"}>
        <div className="flex items-center gap-2">
          <Unplug className="h-5 w-5 text-primary" aria-hidden />
          <CardTitle className={compact ? "text-sm" : undefined}>{t("settings.security.claude.title")}</CardTitle>
        </div>
        <CardDescription className={text}>{t("settings.security.claude.description")}</CardDescription>
      </CardHeader>
      <CardContent className={compact ? "space-y-4 p-3 pt-0" : "space-y-6"}>
        <div className="flex items-center gap-2">
          <code className={`${text} min-w-0 flex-1 truncate text-foreground`}>{serverUrl}</code>
          <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={() => void copyServerUrl()}>
            {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
            {copied ? t("settings.security.claude.copied") : t("settings.security.claude.copy")}
          </Button>
        </div>
        {!organizationId ? <p className={`${text} text-muted-foreground`}>{t("settings.security.claude.noOrganization")}</p> : null}
        {loadError || revokeError ? (
          <Alert variant="destructive">
            <AlertDescription>{loadError || revokeError}</AlertDescription>
          </Alert>
        ) : null}
        {organizationId && loading ? (
          <p className={`${text} text-muted-foreground`} aria-live="polite">
            {t("settings.security.claude.loading")}
          </p>
        ) : null}

        {organizationId && !loading && !loadError ? (
          <section className="space-y-2">
              <h3 className={`${text} font-medium text-foreground`}>{t("settings.security.claude.connections")}</h3>
              {connections.length === 0 ? (
                <p className={`${text} text-muted-foreground`}>{t("settings.security.claude.emptyConnections")}</p>
              ) : (
                <ul className="space-y-2">
                  {connections.map((row) => {
                    const key = rowKey(row);
                    const confirming = pendingKey === key;
                    const revoking = revokingKey === key;
                    return (
                      <li key={key} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
                        <div className="min-w-0">
                          <p className={`${text} font-medium text-foreground`}>
                            {row.full_name?.trim() || t("settings.security.claude.unknownUser")}
                          </p>
                          <p className={`${text} text-muted-foreground`}>
                            {row.client_name?.trim() || t("settings.security.claude.unknownClient")}
                            {" · "}
                            {formatWhen(row.connected_at, i18n.language)}
                          </p>
                        </div>
                        {confirming ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={text}>{t("settings.security.claude.confirm")}</span>
                            <Button type="button" size="sm" variant="destructive" disabled={revoking} onClick={() => void revoke(row)}>
                              {revoking ? t("settings.security.claude.revoking") : t("settings.security.claude.confirmAction")}
                            </Button>
                            <Button type="button" size="sm" variant="outline" disabled={revoking} onClick={() => setPendingKey(null)}>
                              {t("settings.security.claude.cancel")}
                            </Button>
                          </div>
                        ) : (
                          <Button type="button" size="sm" variant="outline" onClick={() => setPendingKey(key)}>
                            {t("settings.security.claude.revoke")}
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
        ) : null}
      </CardContent>
    </Card>
  );
}
