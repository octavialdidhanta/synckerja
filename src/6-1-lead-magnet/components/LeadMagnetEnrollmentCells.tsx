import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ImageIcon, MessageCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/components/ui/avatar";
import { Button } from "@/shared/components/ui/button";
import { useCurrentOrg } from "@/shared/auth/hooks/useCurrentOrg";
import { supabase } from "@/shared/lib/supabaseClient";
import { useLivechatProfilePhoto } from "@/5-3-whatsapp/hooks/useLivechatProfilePhoto";
import type { LeadMagnetCampaignPost, LeadMagnetEnrollment } from "../types/leadMagnet.types";

function enrollmentDisplayName(enrollment: LeadMagnetEnrollment): string {
  const username = (enrollment.participant_username ?? "").trim().replace(/^@/, "");
  if (username) return `@${username}`;
  return enrollment.participant_scoped_id.slice(0, 10);
}

function initialsFromName(name: string): string {
  const cleaned = name.replace(/^@/, "").trim();
  if (!cleaned) return "?";
  return cleaned.slice(0, 2).toUpperCase();
}

function useEnrollmentConversationId(enrollment: LeadMagnetEnrollment): string | null {
  const { organizationId } = useCurrentOrg();
  const direct = (enrollment.conversation_id ?? "").trim() || null;
  const scopedId = (enrollment.participant_scoped_id ?? "").trim();
  const platform = enrollment.platform === "facebook" ? "facebook" : "instagram";

  const { data: lookedUp } = useQuery({
    queryKey: ["lead-magnet-enrollment-conversation", enrollment.id, scopedId, platform],
    enabled: !direct && Boolean(organizationId && scopedId),
    queryFn: async () => {
      if (platform === "facebook") {
        const { data } = await supabase
          .from("facebook_conversations")
          .select("id")
          .eq("organization_id", organizationId)
          .eq("customer_psid", scopedId)
          .limit(1)
          .maybeSingle();
        return (data?.id as string | undefined)?.trim() || null;
      }
      const { data } = await supabase
        .from("instagram_conversations")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("customer_ig_id", scopedId)
        .limit(1)
        .maybeSingle();
      return (data?.id as string | undefined)?.trim() || null;
    },
    staleTime: 5 * 60 * 1000,
  });

  return direct ?? lookedUp ?? null;
}

export function LeadMagnetEnrollmentUserCell({ enrollment }: { enrollment: LeadMagnetEnrollment }) {
  const name = enrollmentDisplayName(enrollment);
  const conversationId = useEnrollmentConversationId(enrollment);
  const isInstagram = enrollment.platform !== "facebook";
  const { profileUrl } = useLivechatProfilePhoto(isInstagram ? conversationId : null, {
    source: "instagram",
  });

  return (
    <div className="flex min-w-0 items-center gap-2">
      <Avatar className="h-8 w-8">
        <AvatarImage src={profileUrl ?? undefined} alt={name} className="object-cover" />
        <AvatarFallback className="text-[10px] font-medium">{initialsFromName(name)}</AvatarFallback>
      </Avatar>
      <span className="truncate text-sm">{name}</span>
    </div>
  );
}

export function LeadMagnetEnrollmentOpenChatCell({
  enrollment,
}: {
  enrollment: LeadMagnetEnrollment;
}) {
  const { t } = useTranslation();
  const conversationId = useEnrollmentConversationId(enrollment);
  if (!conversationId) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-0 text-xs font-medium" asChild>
      <Link to={`/omnichannel/livechat?conversation=${encodeURIComponent(conversationId)}`}>
        <MessageCircle className="h-4 w-4" />
        {t("leadsManagement.dialog.openChat", "Open Chat")}
      </Link>
    </Button>
  );
}

export function findEnrollmentContentPost(
  enrollment: LeadMagnetEnrollment,
  posts: LeadMagnetCampaignPost[],
): LeadMagnetCampaignPost | undefined {
  const mediaId = (enrollment.media_id ?? "").trim();
  if (!mediaId) return undefined;
  const platform = (enrollment.platform ?? "").trim();
  return (
    posts.find((p) => p.media_id === mediaId && (!platform || p.platform === platform)) ??
    posts.find((p) => p.media_id === mediaId)
  );
}

function ContentThumb({
  url,
  alt,
  loading,
}: {
  url: string | null | undefined;
  alt: string;
  loading?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const src = url?.trim() || null;

  if (loading) {
    return <div className="h-9 w-9 shrink-0 animate-pulse rounded-md border bg-muted" aria-hidden />;
  }

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={alt}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="h-9 w-9 shrink-0 rounded-md border object-cover bg-muted"
      />
    );
  }

  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground"
      aria-hidden
    >
      <ImageIcon className="h-4 w-4" />
    </div>
  );
}

export function LeadMagnetEnrollmentContentCell({
  enrollment,
  posts,
  loading,
}: {
  enrollment: LeadMagnetEnrollment;
  posts: LeadMagnetCampaignPost[];
  loading?: boolean;
}) {
  const { t } = useTranslation();
  const post = findEnrollmentContentPost(enrollment, posts);
  const caption = (post?.media_caption ?? "").trim();
  const permalink = (post?.media_permalink ?? "").trim();
  const thumb = (post?.media_thumbnail_url ?? "").trim();

  if (!post && !caption && !permalink) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <div className="flex min-w-0 max-w-[220px] items-start gap-2">
      <ContentThumb url={thumb} alt={caption} loading={loading && !thumb} />
      <div className="min-w-0">
        {caption ? (
          <p className="truncate text-xs leading-snug" title={caption}>
            {caption}
          </p>
        ) : null}
        {permalink ? (
          <a
            href={permalink}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate text-[11px] leading-snug text-primary hover:underline"
          >
            {t("leadMagnet.list.viewPost")}
          </a>
        ) : null}
      </div>
    </div>
  );
}
