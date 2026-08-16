import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { cn } from "@/shared/lib/utils";
import {
  useLinkedInContentSettings,
  type LinkedInPendingPage,
} from "@/linkedin-content/hooks/useLinkedInContentSettings";
import type { LinkedInContentOAuthReturnPath } from "@/linkedin-content/settings/linkedinContentSettingsPaths";

export type LinkedInContentSettingsPanelProps = {
  organizationId: string | null | undefined;
  enabled?: boolean;
  oauthReturnPath: LinkedInContentOAuthReturnPath;
  className?: string;
};

export function LinkedInContentSettingsPanel({
  organizationId,
  enabled = true,
  oauthReturnPath,
  className,
}: LinkedInContentSettingsPanelProps) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingPages, setPendingPages] = useState<LinkedInPendingPage[]>([]);
  const [selectedPageId, setSelectedPageId] = useState("");

  const {
    data,
    isLoading,
    startOAuth,
    disconnect,
    setDefaultAccount,
    deleteAccount,
    getPendingPages,
    completePageConnect,
  } = useLinkedInContentSettings(organizationId, { enabled: Boolean(organizationId) && enabled });

  const oauthConnected = data?.oauthConnected ?? false;
  const serverConfigured = data?.serverConfigured !== false;
  const accounts = data?.accounts ?? [];

  const loadPendingPages = async () => {
    if (!organizationId) return;
    try {
      const result = await getPendingPages.mutateAsync();
      if (result.pending && result.pages.length > 0) {
        setPendingPages(result.pages);
        setSelectedPageId(result.pages[0]?.page_id ?? "");
        setPickerOpen(true);
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  useEffect(() => {
    const connected = searchParams.get("connected");
    const existing = searchParams.get("existing");
    const oauthError = searchParams.get("oauth_error");
    const selectPage = searchParams.get("select_page");

    if (selectPage === "1") {
      void loadPendingPages();
      searchParams.delete("select_page");
      setSearchParams(searchParams, { replace: true });
    }

    if (connected === "1") {
      if (existing === "1") {
        toast.info(
          t(
            "digitalMarketing.linkedinContent.reconnectedToast",
            "This LinkedIn page is already connected. Sign in with a different LinkedIn account to add another.",
          ),
        );
      } else {
        toast.success(
          t("digitalMarketing.linkedinContent.connectedToast", "LinkedIn page connected successfully."),
        );
      }
      searchParams.delete("connected");
      searchParams.delete("existing");
      setSearchParams(searchParams, { replace: true });
    }
    if (oauthError) {
      const oauthErrorDesc = searchParams.get("oauth_error_desc") ?? "";
      const displayMessage =
        oauthError === "OK"
          ? t(
              "digitalMarketing.linkedinContent.oauthErrorGeneric",
              "Sign-in failed while saving LinkedIn tokens. Please try Connect again.",
            )
          : oauthError === "invalid_scope_error" || oauthError === "unauthorized_scope_error"
            ? t(
                "digitalMarketing.linkedinContent.oauthScopeNotApproved",
                "LinkedIn rejected the requested permissions. Ensure Community Management API is approved on your Synckerja Content Insight app, then try Connect again.",
              )
            : oauthErrorDesc || oauthError;
      toast.error(
        t("digitalMarketing.linkedinContent.oauthErrorToast", {
          message: displayMessage,
          defaultValue: `Sign-in failed: ${displayMessage}`,
        }),
      );
      searchParams.delete("oauth_error");
      searchParams.delete("oauth_error_desc");
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run on mount/query params only
  }, [searchParams, setSearchParams, t]);

  const handleConfirmPage = async () => {
    if (!selectedPageId) return;
    try {
      const result = await completePageConnect.mutateAsync(selectedPageId);
      setPickerOpen(false);
      setPendingPages([]);
      if (result.isExistingAccount) {
        toast.info(
          t(
            "digitalMarketing.linkedinContent.reconnectedToast",
            "This LinkedIn page is already connected. Sign in with a different LinkedIn account to add another.",
          ),
        );
      } else {
        toast.success(
          t("digitalMarketing.linkedinContent.connectedToast", "LinkedIn page connected successfully."),
        );
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (isLoading) {
    return (
      <div className={cn("space-y-3 p-4", className)}>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <>
      <div className={cn("space-y-4 p-4", className)}>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {t("digitalMarketing.linkedinContent.settingsTitle", "LinkedIn Content")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t(
              "digitalMarketing.linkedinContent.settingsDesc",
              "Connect LinkedIn pages via OAuth to pull organic post insights.",
            )}
          </p>
        </div>

        {!serverConfigured && (
          <Alert variant="destructive">
            <AlertTitle>
              {t("digitalMarketing.linkedinContent.serverNotConfigured", "Server not configured")}
            </AlertTitle>
            <AlertDescription>
              {t(
                "digitalMarketing.linkedinContent.serverNotConfiguredDesc",
                "Set LINKEDIN_CONTENT_CLIENT_ID and LINKEDIN_CONTENT_CLIENT_SECRET in Supabase Edge Function secrets.",
              )}
            </AlertDescription>
          </Alert>
        )}

        {serverConfigured && !oauthConnected && (
          <Alert>
            <AlertTitle>
              {t("digitalMarketing.linkedinContent.apiApprovalRequired", "LinkedIn API approval required")}
            </AlertTitle>
            <AlertDescription>
              {t(
                "digitalMarketing.linkedinContent.apiApprovalRequiredDesc",
                "Connect needs Community Management API approved on app Synckerja Content Insight (Client ID 86ai8f4j1twr9q). Use that app’s credentials in Supabase — not Synckerja Office. Check Products tab for Added status, then try Connect again.",
              )}
            </AlertDescription>
          </Alert>
        )}

        {accounts.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {t(
              "digitalMarketing.linkedinContent.connectAnotherHint",
              "To add another page, click Connect and sign in with a different LinkedIn account on the LinkedIn screen.",
            )}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={!serverConfigured || startOAuth.isPending}
            onClick={() =>
              startOAuth.mutate(oauthReturnPath, {
                onError: (e) => toast.error((e as Error).message),
              })
            }
          >
            {startOAuth.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {accounts.length > 0
              ? t("digitalMarketing.linkedinContent.connectAnotherAccount", "Connect another LinkedIn page")
              : t("digitalMarketing.linkedinContent.connectAccount", "Connect LinkedIn page")}
          </Button>
          {oauthConnected && (
            <Button
              type="button"
              variant="outline"
              disabled={disconnect.isPending}
              onClick={() => disconnect.mutate(undefined)}
            >
              {disconnect.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("digitalMarketing.linkedinContent.disconnectAll", "Disconnect all")}
            </Button>
          )}
        </div>

        {accounts.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("digitalMarketing.linkedinContent.connectedAccounts", "Connected pages")}
            </p>
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  {acc.thumbnail_url ? (
                    <img src={acc.thumbnail_url} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                  ) : null}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{acc.label || acc.display_name}</p>
                    <p className="truncate text-xs text-muted-foreground">{acc.page_id}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {!acc.is_default && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setDefaultAccount.mutate(acc.id)}
                    >
                      {t("digitalMarketing.linkedinContent.setDefault", "Set default")}
                    </Button>
                  )}
                  {acc.is_default && (
                    <span className="text-xs text-primary">
                      {t("digitalMarketing.linkedinContent.default", "Default")}
                    </span>
                  )}
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={t("digitalMarketing.linkedinContent.removeAccount", "Remove page")}
                    onClick={() => deleteAccount.mutate(acc.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("digitalMarketing.linkedinContent.selectPageTitle", "Select LinkedIn page")}
            </DialogTitle>
            <DialogDescription>
              {t(
                "digitalMarketing.linkedinContent.selectPageDesc",
                "Your LinkedIn account manages multiple pages. Choose one page to connect to this organization.",
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {pendingPages.map((page) => (
              <label
                key={page.page_id}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2",
                  selectedPageId === page.page_id
                    ? "border-primary bg-primary/5"
                    : "border-gray-200 hover:bg-gray-50",
                )}
              >
                <input
                  type="radio"
                  name="linkedin-page"
                  className="sr-only"
                  checked={selectedPageId === page.page_id}
                  onChange={() => setSelectedPageId(page.page_id)}
                />
                {page.thumbnail_url ? (
                  <img src={page.thumbnail_url} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                ) : null}
                <div className="min-w-0">
                  <p className="truncate font-medium">{page.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{page.page_id}</p>
                </div>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPickerOpen(false)}>
              {t("common.cancel", "Cancel")}
            </Button>
            <Button
              type="button"
              disabled={!selectedPageId || completePageConnect.isPending}
              onClick={() => void handleConfirmPage()}
            >
              {completePageConnect.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("digitalMarketing.linkedinContent.confirmPage", "Connect page")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
