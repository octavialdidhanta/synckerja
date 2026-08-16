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
  useYouTubeContentSettings,
  type YouTubePendingChannel,
} from "@/youtube-content/hooks/useYouTubeContentSettings";
import type { YouTubeContentOAuthReturnPath } from "@/youtube-content/settings/youtubeContentSettingsPaths";

export type YouTubeContentSettingsPanelProps = {
  organizationId: string | null | undefined;
  enabled?: boolean;
  oauthReturnPath: YouTubeContentOAuthReturnPath;
  className?: string;
};

export function YouTubeContentSettingsPanel({
  organizationId,
  enabled = true,
  oauthReturnPath,
  className,
}: YouTubeContentSettingsPanelProps) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingChannels, setPendingChannels] = useState<YouTubePendingChannel[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState("");

  const {
    data,
    isLoading,
    startOAuth,
    disconnect,
    setDefaultAccount,
    deleteAccount,
    getPendingChannels,
    completeChannelConnect,
  } = useYouTubeContentSettings(organizationId, { enabled: Boolean(organizationId) && enabled });

  const oauthConnected = data?.oauthConnected ?? false;
  const serverConfigured = data?.serverConfigured !== false;
  const accounts = data?.accounts ?? [];

  const loadPendingChannels = async () => {
    if (!organizationId) return;
    try {
      const result = await getPendingChannels.mutateAsync();
      if (result.pending && result.channels.length > 0) {
        setPendingChannels(result.channels);
        setSelectedChannelId(result.channels[0]?.channel_id ?? "");
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
    const selectChannel = searchParams.get("select_channel");

    if (selectChannel === "1") {
      void loadPendingChannels();
      searchParams.delete("select_channel");
      setSearchParams(searchParams, { replace: true });
    }

    if (connected === "1") {
      if (existing === "1") {
        toast.info(
          t(
            "digitalMarketing.youtubeContent.reconnectedToast",
            "This YouTube channel is already connected. Sign in with a different Google account to add another.",
          ),
        );
      } else {
        toast.success(
          t("digitalMarketing.youtubeContent.connectedToast", "YouTube channel connected successfully."),
        );
      }
      searchParams.delete("connected");
      searchParams.delete("existing");
      setSearchParams(searchParams, { replace: true });
    }
    if (oauthError) {
      const displayMessage =
        oauthError === "OK"
          ? t(
              "digitalMarketing.youtubeContent.oauthErrorGeneric",
              "Sign-in failed while saving YouTube tokens. Please try Connect again.",
            )
          : oauthError;
      toast.error(
        t("digitalMarketing.youtubeContent.oauthErrorToast", {
          message: displayMessage,
          defaultValue: `Sign-in failed: ${displayMessage}`,
        }),
      );
      searchParams.delete("oauth_error");
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run on mount/query params only
  }, [searchParams, setSearchParams, t]);

  const handleConfirmChannel = async () => {
    if (!selectedChannelId) return;
    try {
      const result = await completeChannelConnect.mutateAsync(selectedChannelId);
      setPickerOpen(false);
      setPendingChannels([]);
      if (result.isExistingAccount) {
        toast.info(
          t(
            "digitalMarketing.youtubeContent.reconnectedToast",
            "This YouTube channel is already connected. Sign in with a different Google account to add another.",
          ),
        );
      } else {
        toast.success(
          t("digitalMarketing.youtubeContent.connectedToast", "YouTube channel connected successfully."),
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
            {t("digitalMarketing.youtubeContent.settingsTitle", "YouTube Content")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t(
              "digitalMarketing.youtubeContent.settingsDesc",
              "Connect YouTube channels via Google OAuth to pull organic video insights.",
            )}
          </p>
        </div>

        {!serverConfigured && (
          <Alert variant="destructive">
            <AlertTitle>
              {t("digitalMarketing.youtubeContent.serverNotConfigured", "Server not configured")}
            </AlertTitle>
            <AlertDescription>
              {t(
                "digitalMarketing.youtubeContent.serverNotConfiguredDesc",
                "Set YOUTUBE_CONTENT_CLIENT_ID and YOUTUBE_CONTENT_CLIENT_SECRET in Supabase Edge Function secrets.",
              )}
            </AlertDescription>
          </Alert>
        )}

        {oauthConnected &&
          accounts.some((a) => a.is_active && a.upload_scopes_granted === false) && (
            <Alert variant="destructive">
              <AlertTitle>
                {t(
                  "digitalMarketing.youtubeContent.reconnectForUploadTitle",
                  "Video upload authorization required",
                )}
              </AlertTitle>
              <AlertDescription>
                {t(
                  "digitalMarketing.youtubeContent.reconnectForUploadDesc",
                  "Your YouTube channel is connected for insights, but scheduling and Post Now need the youtube.upload scope. Click Connect YouTube channel below and approve upload access on the Google screen.",
                )}
              </AlertDescription>
            </Alert>
          )}

        {oauthConnected &&
          accounts.some((a) => a.is_active && a.comments_scopes_granted === false) && (
            <Alert>
              <AlertTitle>
                {t(
                  "digitalMarketing.manageComments.youtubeReconnectForCommentsTitle",
                  "Reconnect for comment access",
                )}
              </AlertTitle>
              <AlertDescription>
                {t(
                  "digitalMarketing.manageComments.youtubeReconnectForComments",
                  "Reconnect your YouTube channel to grant the youtube.force-ssl scope required to read and reply to comments.",
                )}
              </AlertDescription>
            </Alert>
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
              ? t("digitalMarketing.youtubeContent.connectAnotherAccount", "Connect another YouTube channel")
              : t("digitalMarketing.youtubeContent.connectAccount", "Connect YouTube channel")}
          </Button>
          {oauthConnected && (
            <Button
              type="button"
              variant="outline"
              disabled={disconnect.isPending}
              onClick={() => disconnect.mutate(undefined)}
            >
              {disconnect.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("digitalMarketing.youtubeContent.disconnectAll", "Disconnect all")}
            </Button>
          )}
        </div>

        {accounts.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("digitalMarketing.youtubeContent.connectedAccounts", "Connected channels")}
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
                    <p className="truncate text-xs text-muted-foreground">{acc.channel_id}</p>
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
                      {t("digitalMarketing.youtubeContent.setDefault", "Set default")}
                    </Button>
                  )}
                  {acc.is_default && (
                    <span className="text-xs text-primary">
                      {t("digitalMarketing.youtubeContent.default", "Default")}
                    </span>
                  )}
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={t("digitalMarketing.youtubeContent.removeAccount", "Remove channel")}
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
              {t("digitalMarketing.youtubeContent.selectChannelTitle", "Select YouTube channel")}
            </DialogTitle>
            <DialogDescription>
              {t(
                "digitalMarketing.youtubeContent.selectChannelDesc",
                "Your Google account manages multiple channels. Choose one channel to connect to this organization.",
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {pendingChannels.map((ch) => (
              <label
                key={ch.channel_id}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2",
                  selectedChannelId === ch.channel_id
                    ? "border-primary bg-primary/5"
                    : "border-gray-200 hover:bg-gray-50",
                )}
              >
                <input
                  type="radio"
                  name="youtube-channel"
                  className="sr-only"
                  checked={selectedChannelId === ch.channel_id}
                  onChange={() => setSelectedChannelId(ch.channel_id)}
                />
                {ch.thumbnail_url ? (
                  <img src={ch.thumbnail_url} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                ) : null}
                <div className="min-w-0">
                  <p className="truncate font-medium">{ch.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{ch.channel_id}</p>
                </div>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPickerOpen(false)}
            >
              {t("common.cancel", "Cancel")}
            </Button>
            <Button
              type="button"
              disabled={!selectedChannelId || completeChannelConnect.isPending}
              onClick={() => void handleConfirmChannel()}
            >
              {completeChannelConnect.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("digitalMarketing.youtubeContent.confirmChannel", "Connect channel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
