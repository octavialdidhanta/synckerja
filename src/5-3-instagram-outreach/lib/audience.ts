export {
  INSTAGRAM_USERNAME_RE,
  OUTREACH_DAILY_COPY_SOFT_CAP,
  OUTREACH_DISCOVER_COMMENT_CAP,
  OUTREACH_MAX_MATERIALS,
  OUTREACH_MEDIA_BUCKET,
  applyManualPaste,
  collectDiscoveredComments,
  interpolateOutreachBody,
  jakartaDayStartIso,
  mergeDiscoveredComments,
  normalizeInstagramUsername,
  parseManualUsernames,
} from "../../../supabase/functions/_shared/instagramOutreach/audience.ts";

export type {
  AudienceSource,
  AudienceStatus,
  DiscoveredComment,
  ExistingAudienceRow,
  ManualKind,
  MergedAudienceChange,
  RawOutreachComment,
  RawOutreachMedia,
} from "../../../supabase/functions/_shared/instagramOutreach/audience.ts";
