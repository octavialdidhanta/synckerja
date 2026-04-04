import { z } from "zod";

/** Nilai disimpan ke kolom `platform` (slug lowercase, konsisten dengan filter). */
export const KOL_CONTENT_PLATFORM_OPTIONS = [
  {
    value: "instagram",
    label: "Instagram",
    description: "Feed, Stories, Reels",
  },
  {
    value: "tiktok",
    label: "TikTok",
    description: "Video pendek, LIVE Shop",
  },
  {
    value: "youtube",
    label: "YouTube",
    description: "Long-form, Shorts, Community",
  },
  {
    value: "facebook",
    label: "Facebook",
    description: "Feed, Reels, Stories",
  },
  {
    value: "twitter",
    label: "X (Twitter)",
    description: "Post, thread, video",
  },
  {
    value: "threads",
    label: "Threads",
    description: "Teks & gambar",
  },
  {
    value: "linkedin",
    label: "LinkedIn",
    description: "Post, newsletter, video",
  },
  {
    value: "snapchat",
    label: "Snapchat",
    description: "Story, Spotlight",
  },
  {
    value: "pinterest",
    label: "Pinterest",
    description: "Pin, Idea Pin",
  },
  {
    value: "twitch",
    label: "Twitch",
    description: "Live, clip, VOD",
  },
] as const;

/** Nilai disimpan ke kolom `content_type`. */
export const KOL_CONTENT_TYPE_OPTIONS = [
  {
    value: "post",
    label: "Post / Feed",
    description: "Satu unggahan di feed utama",
  },
  {
    value: "story",
    label: "Story",
    description: "Konten ephemeral / 24 jam",
  },
  {
    value: "reel",
    label: "Reel / short vertical",
    description: "Video vertikal pendek (IG, FB, TikTok-style)",
  },
  {
    value: "shorts",
    label: "Shorts",
    description: "YouTube Shorts",
  },
  {
    value: "video",
    label: "Video panjang",
    description: "Video berdurasi lebih panjang",
  },
  {
    value: "live",
    label: "Live",
    description: "Siaran langsung",
  },
  {
    value: "carousel",
    label: "Carousel",
    description: "Beberapa slide dalam satu unggahan",
  },
  {
    value: "review",
    label: "Review / UGC",
    description: "Ulasan atau konten organik",
  },
] as const;

export type KolContentPlatformValue = (typeof KOL_CONTENT_PLATFORM_OPTIONS)[number]["value"];
export type KolContentTypeValue = (typeof KOL_CONTENT_TYPE_OPTIONS)[number]["value"];

const platformValues = KOL_CONTENT_PLATFORM_OPTIONS.map((o) => o.value) as [
  KolContentPlatformValue,
  ...KolContentPlatformValue[],
];

const contentTypeValues = KOL_CONTENT_TYPE_OPTIONS.map((o) => o.value) as [
  KolContentTypeValue,
  ...KolContentTypeValue[],
];

export const kolContentPlatformSchema = z.enum(platformValues);
export const kolContentTypeSchema = z.enum(contentTypeValues);
