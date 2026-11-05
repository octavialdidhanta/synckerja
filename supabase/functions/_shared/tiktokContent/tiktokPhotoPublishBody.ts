const PHOTO_TITLE_MAX = 90;
const PHOTO_DESCRIPTION_MAX = 4000;
const PHOTO_IMAGE_MAX = 35;

export function buildTikTokPhotoDirectPostBody(args: {
  title: string;
  description: string;
  privacyLevel: string;
  disableComment: boolean;
  photoImages: string[];
  photoCoverIndex?: number;
}): Record<string, unknown> {
  const photoImages = args.photoImages.map((url) => url.trim()).filter(Boolean);
  if (photoImages.length < 1 || photoImages.length > PHOTO_IMAGE_MAX) {
    throw new Error("invalid_photo_images");
  }
  const description = args.description.replace(/\s+/g, " ").trim().slice(0, PHOTO_DESCRIPTION_MAX);
  const title = (args.title.trim() || description).slice(0, PHOTO_TITLE_MAX) || " ";
  return {
    post_mode: "DIRECT_POST",
    media_type: "PHOTO",
    post_info: {
      title,
      description,
      privacy_level: args.privacyLevel,
      disable_comment: args.disableComment,
      auto_add_music: true,
      brand_content_toggle: false,
      brand_organic_toggle: false,
    },
    source_info: {
      source: "PULL_FROM_URL",
      photo_cover_index: args.photoCoverIndex ?? 0,
      photo_images: photoImages,
    },
  };
}
