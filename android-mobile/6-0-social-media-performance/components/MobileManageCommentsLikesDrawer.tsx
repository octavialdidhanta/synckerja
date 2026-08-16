import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/mobile-app/components/ui/drawer";
import { useMetaContentPostLikersQuery } from "@/meta-content/hooks/useMetaContentPostLikersQuery";
import { useMetaCommentAuthorAvatarObjectUrl } from "@/meta-content/lib/useMetaCommentAuthorAvatarObjectUrl";
import type { MetaContentPlatform } from "@/meta-platform/types/metaContentTypes";

type MobileManageCommentsLikesDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  platform: MetaContentPlatform;
  accountId: string;
  mediaId: string;
};

function LikerRow({
  organizationId,
  platform,
  accountId,
  name,
  username,
  userId,
  avatarUrl,
}: {
  organizationId: string;
  platform: MetaContentPlatform;
  accountId: string;
  name: string;
  username: string | null;
  userId: string;
  avatarUrl: string | null;
}) {
  const proxied = useMetaCommentAuthorAvatarObjectUrl({
    organizationId,
    platform,
    accountId,
    username: platform === "instagram" ? username ?? name : null,
    userId: platform === "facebook" ? userId : null,
  });
  const src = proxied ?? avatarUrl ?? undefined;
  const initials = name.slice(0, 2).toUpperCase();

  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <Avatar className="h-9 w-9 shrink-0">
        <AvatarImage src={src} alt={name} referrerPolicy="no-referrer" />
        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
      </Avatar>
      <p className="min-w-0 truncate text-sm font-medium text-foreground">{name}</p>
    </div>
  );
}

export function MobileManageCommentsLikesDrawer({
  open,
  onOpenChange,
  organizationId,
  platform,
  accountId,
  mediaId,
}: MobileManageCommentsLikesDrawerProps) {
  const { t } = useTranslation();
  const likesQuery = useMetaContentPostLikersQuery({
    organizationId,
    platform,
    accountId,
    mediaId,
    enabled: open,
  });
  const likers = likesQuery.data?.likers ?? [];
  const unavailable = likesQuery.data?.unavailable === true;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh] px-0 pb-4">
        <DrawerHeader className="px-4 pb-2 text-left">
          <DrawerTitle className="text-base">
            {t("digitalMarketing.manageComments.likedByTitle", "Liked by")}
          </DrawerTitle>
        </DrawerHeader>
        <div className="max-h-[min(60vh,360px)] overflow-y-auto">
          {likesQuery.isLoading ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              {t("digitalMarketing.manageComments.loadingLikes", "Loading likes…")}
            </p>
          ) : unavailable ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              {t(
                "digitalMarketing.manageComments.likesUnavailable",
                "Facebook does not share who liked this post.",
              )}
            </p>
          ) : likers.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              {t("digitalMarketing.manageComments.noLikesYet", "No likes yet.")}
            </p>
          ) : (
            likers.map((liker) => (
              <LikerRow
                key={liker.id || liker.name}
                organizationId={organizationId}
                platform={platform}
                accountId={accountId}
                name={liker.name}
                username={liker.username}
                userId={liker.id}
                avatarUrl={liker.avatar_url}
              />
            ))
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

MobileManageCommentsLikesDrawer.displayName = "MobileManageCommentsLikesDrawer";
