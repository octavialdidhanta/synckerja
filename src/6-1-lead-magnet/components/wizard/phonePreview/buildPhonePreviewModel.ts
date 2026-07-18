import {
  DEFAULT_DELIVERY_LINK_LABEL,
  resolveDeliveryLinks,
  truncateDeliveryButtonLabel,
} from '../../../lib/deliveryLinks';
import type { LeadMagnetCampaignForm, LeadMagnetCampaignPost } from '../../../types/leadMagnet.types';
import { interpolatePreviewText, truncatePreviewLines } from './interpolatePreviewText';

export type PhonePreviewTab = 'post' | 'comments' | 'dm';

export type PhonePreviewAccount = {
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

export type PhonePreviewDmMessage =
  | {
      id: string;
      kind: 'incoming';
      text: string;
      buttons?: string[];
    }
  | {
      id: string;
      kind: 'outgoing';
      text: string;
    };

export type PhonePreviewModel = {
  account: PhonePreviewAccount;
  post: {
    thumbnailUrl: string | null;
    caption: string;
    likeCountLabel: string;
    commentCountLabel: string;
    dateLabel: string;
  };
  comments: {
    userComment: string;
    accountReply: string | null;
  };
  dmMessages: PhonePreviewDmMessage[];
};

function pickPreviewPost(posts: LeadMagnetCampaignPost[]): LeadMagnetCampaignPost | null {
  const ig = posts.find((p) => p.platform === 'instagram');
  if (ig) return ig;
  return posts[0] ?? null;
}

function sanitizeUsername(label: string): string {
  const raw = label.trim().replace(/^@+/, '');
  return raw || 'brand';
}

export function buildPhonePreviewModel(
  form: LeadMagnetCampaignForm,
  ctx: {
    accountLabel: string;
    accountAvatarUrl: string | null;
    sampleUsername?: string;
  },
): PhonePreviewModel {
  const brandUsername = sanitizeUsername(ctx.accountLabel);
  const participantUsername = (ctx.sampleUsername?.trim() || 'Username').replace(/^@+/, '');
  const vars = {
    username: participantUsername,
    campaignName: form.name.trim() || 'Campaign',
  };

  const post = pickPreviewPost(form.posts);
  const captionRaw = post?.media_caption?.trim() || '';
  const caption = captionRaw
    ? truncatePreviewLines(captionRaw, 120)
    : '';

  const keyword = form.keyword.trim() || 'Keyword';
  const replySlot = form.comment_reply_texts?.[0]?.trim() ?? '';
  const accountReply =
    form.comment_reply_enabled && replySlot
      ? truncatePreviewLines(replySlot, 160)
      : null;

  const dmMessages: PhonePreviewDmMessage[] = [];
  let seq = 0;
  const nextId = (prefix: string) => `${prefix}-${seq++}`;

  const openingOn = !form.skip_material_offer;
  const followOn = !form.skip_follow_gate_if_follower;

  if (openingOn) {
    const openingText = interpolatePreviewText(form.framework_offer_text, vars);
    const openingBtn = truncateDeliveryButtonLabel(
      form.framework_button_label.trim() || 'Send me the link',
    );
    dmMessages.push({
      id: nextId('opening'),
      kind: 'incoming',
      text: truncatePreviewLines(openingText),
      buttons: [openingBtn],
    });
    dmMessages.push({
      id: nextId('opening-tap'),
      kind: 'outgoing',
      text: openingBtn,
    });
  }

  if (followOn) {
    const followText = interpolatePreviewText(form.follow_gate_text, vars);
    const followBtn = truncateDeliveryButtonLabel(
      form.follow_button_label.trim() || 'Sudah Follow',
    );
    dmMessages.push({
      id: nextId('follow'),
      kind: 'incoming',
      text: truncatePreviewLines(followText),
      buttons: [followBtn],
    });
    dmMessages.push({
      id: nextId('follow-tap'),
      kind: 'outgoing',
      text: followBtn,
    });
  }

  if (form.email_collection_enabled) {
    const emailText = interpolatePreviewText(form.contact_prompt_text, vars);
    if (emailText.trim()) {
      dmMessages.push({
        id: nextId('email'),
        kind: 'incoming',
        text: truncatePreviewLines(emailText),
      });
    }
  }

  const deliveryText = interpolatePreviewText(form.delivery_text, vars);
  const links = resolveDeliveryLinks({
    delivery_links: form.delivery_links,
    delivery_button_label: form.delivery_button_label,
    delivery_url: form.delivery_url,
  });
  const deliveryButtons =
    links.length > 0
      ? links.slice(0, 3).map((l) =>
        truncateDeliveryButtonLabel(l.label.trim() || DEFAULT_DELIVERY_LINK_LABEL),
      )
      : [truncateDeliveryButtonLabel(form.delivery_button_label.trim() || DEFAULT_DELIVERY_LINK_LABEL)];

  dmMessages.push({
    id: nextId('delivery'),
    kind: 'incoming',
    text: truncatePreviewLines(deliveryText),
    buttons: deliveryButtons,
  });

  return {
    account: {
      username: brandUsername,
      displayName: brandUsername.toUpperCase(),
      avatarUrl: ctx.accountAvatarUrl,
    },
    post: {
      thumbnailUrl: post?.media_thumbnail_url?.trim() || null,
      caption,
      likeCountLabel: '1',
      commentCountLabel: form.comment_reply_enabled ? '2' : '1',
      dateLabel: '',
    },
    comments: {
      userComment: keyword,
      accountReply,
    },
    dmMessages,
  };
}
