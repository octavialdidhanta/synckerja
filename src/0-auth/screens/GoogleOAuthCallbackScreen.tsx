import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";
import { supabase } from "@/shared/lib/supabaseClient";
import {
  GOOGLE_DRIVE_OAUTH_SUCCESS_MESSAGE_TYPE,
  getGoogleOAuthRedirectUri,
  getGoogleOAuthRedirectUriForCallback,
  GOOGLE_OAUTH_REFRESH_HINT_KEY,
  GOOGLE_OAUTH_STATE_STORAGE_KEY,
} from "@/shared/lib/googleDriveOAuth";

type ExchangeState =
  | { status: "idle" }
  | { status: "exchanging" }
  | { status: "success"; scope: string | null; hasRefreshToken: boolean }
  | { status: "error"; message: string }
  | { status: "need_login" };

/**
 * OAuth 2.0 redirect target for Google (Drive API, etc.) — inner UI + logic.
 */
export function GoogleOAuthCallbackScreen() {
  const [searchParams] = useSearchParams();
  const [exchange, setExchange] = useState<ExchangeState>({ status: "idle" });
  const ranRef = useRef(false);

  const { oauthError, oauthErrorDescription, code, oauthState } = useMemo(() => {
    return {
      oauthError: searchParams.get("error"),
      oauthErrorDescription: searchParams.get("error_description"),
      code: searchParams.get("code"),
      oauthState: searchParams.get("state"),
    };
  }, [searchParams]);

  const returnPath = useMemo(() => {
    const q = searchParams.toString();
    return q ? `/auth/google/callback?${q}` : "/auth/google/callback";
  }, [searchParams]);

  useEffect(() => {
    if (oauthError || !code) return;
    if (ranRef.current) return;
    ranRef.current = true;

    let cancelled = false;

    (async () => {
      const expectedState =
        localStorage.getItem(GOOGLE_OAUTH_STATE_STORAGE_KEY) ??
        sessionStorage.getItem(GOOGLE_OAUTH_STATE_STORAGE_KEY);
      if (expectedState) {
        try {
          localStorage.removeItem(GOOGLE_OAUTH_STATE_STORAGE_KEY);
        } catch {
          /* ignore */
        }
        sessionStorage.removeItem(GOOGLE_OAUTH_STATE_STORAGE_KEY);
        if (!oauthState || oauthState !== expectedState) {
          setExchange({
            status: "error",
            message:
              "Permintaan OAuth tidak valid (state). Tutup tab ini dan mulai lagi dari Hubungkan Google di preview.",
          });
          return;
        }
      }

      setExchange({ status: "exchanging" });
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session) {
        setExchange({ status: "need_login" });
        return;
      }

      const redirectUri = getGoogleOAuthRedirectUriForCallback();
      const { data, error } = await supabase.functions.invoke<{
        ok?: boolean;
        scope?: string | null;
        has_refresh_token?: boolean;
        error?: string;
      }>("google-oauth-token", {
        body: { code, redirect_uri: redirectUri },
      });

      if (cancelled) return;

      if (error) {
        setExchange({
          status: "error",
          message: error.message || "Gagal menghubungi server",
        });
        return;
      }

      if (data?.ok) {
        try {
          localStorage.setItem(GOOGLE_OAUTH_REFRESH_HINT_KEY, String(Date.now()));
        } catch {
          /* ignore */
        }
        try {
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage(
              { type: GOOGLE_DRIVE_OAUTH_SUCCESS_MESSAGE_TYPE },
              window.location.origin,
            );
          }
        } catch {
          /* ignore */
        }
        setExchange({
          status: "success",
          scope: data.scope ?? null,
          hasRefreshToken: Boolean(data.has_refresh_token),
        });
        window.setTimeout(() => {
          try {
            window.close();
          } catch {
            /* ignore */
          }
        }, 600);
        return;
      }

      setExchange({
        status: "error",
        message: typeof data?.error === "string" ? data.error : "Penukaran token gagal",
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [code, oauthError, oauthState]);

  return (
    <div className="mx-auto w-full max-w-md space-y-6 px-4 py-8">
      <h1 className="text-xl font-semibold tracking-tight">Google</h1>

      {oauthError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-medium text-destructive">Authorization ditolak atau gagal</p>
          <p className="mt-1 text-muted-foreground">
            {oauthError}
            {oauthErrorDescription ? ` — ${oauthErrorDescription}` : null}
          </p>
          {oauthError === "redirect_uri_mismatch" ? (
            <p className="mt-3 text-muted-foreground">
              Tambahkan URI ini di Google Cloud Console → OAuth client (tipe Web) → Authorized redirect
              URIs, lalu coba lagi:
              <code className="mt-1 block break-all rounded bg-muted px-2 py-1 text-xs">
                {getGoogleOAuthRedirectUri()}
              </code>
              Gunakan OAuth client <strong>GOOGLE_CLIENT_ID</strong> (Drive), bukan client Google Ads.
            </p>
          ) : null}
        </div>
      ) : !code ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
          <p className="font-medium text-amber-900 dark:text-amber-100">Tidak ada kode otorisasi di URL</p>
          <p className="mt-1 text-muted-foreground">
            Buka aplikasi dari alur &quot;Hubungkan Google&quot; yang mengarahkan ke Google OAuth.
          </p>
        </div>
      ) : exchange.status === "exchanging" || exchange.status === "idle" ? (
        <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
          <p className="font-medium">Menyimpan koneksi Google…</p>
          <p className="mt-2 text-muted-foreground">Mohon tunggu sebentar.</p>
        </div>
      ) : exchange.status === "need_login" ? (
        <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
          <p className="font-medium">Masuk dulu</p>
          <p className="mt-2 text-muted-foreground">
            Untuk menyelesaikan penghubungan Google, login ke Synckerja lalu buka kembali tautan ini atau ulangi dari
            pengaturan.
          </p>
          <Button asChild className="mt-4 w-full">
            <Link to={`/login?redirectTo=${encodeURIComponent(returnPath)}`}>Ke halaman masuk</Link>
          </Button>
        </div>
      ) : exchange.status === "success" ? (
        <div className="rounded-lg border border-green-600/30 bg-green-600/5 p-4 text-sm">
          <p className="font-medium text-green-900 dark:text-green-100">Google terhubung</p>
          <p className="mt-2 text-muted-foreground">
            Jendela ini akan menutup otomatis. Kembali ke tab aplikasi untuk melanjutkan pratinjau.
          </p>
          {exchange.scope ? (
            <p className="mt-2 break-all text-xs text-muted-foreground">Scope: {exchange.scope}</p>
          ) : null}
          {!exchange.hasRefreshToken ? (
            <p className="mt-2 text-muted-foreground">
              Google tidak mengirim refresh token. Untuk akses jangka panjang, gunakan{" "}
              <code className="rounded bg-muted px-1">access_type=offline</code> dan{" "}
              <code className="rounded bg-muted px-1">prompt=consent</code> pada URL otorisasi.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-medium text-destructive">Gagal menyimpan token</p>
          <p className="mt-1 text-muted-foreground">{exchange.message}</p>
        </div>
      )}

      {exchange.status !== "need_login" ? (
        <Button asChild variant="outline" className="w-full">
          <Link to="/">Kembali ke beranda</Link>
        </Button>
      ) : null}
    </div>
  );
}
