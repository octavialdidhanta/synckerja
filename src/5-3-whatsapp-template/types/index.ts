/** Raw item from Meta `message_templates` list (subset). */
export type MetaMessageTemplate = {
  id?: string;
  name?: string;
  status?: string;
  /** Meta template quality from customer feedback (`GREEN` | `YELLOW` | `RED` | `UNKNOWN`). */
  quality_score?: { score?: string; date?: number } | string | null;
  /** Legacy/alternate Graph field on some API versions. */
  quality_rating?: string;
  category?: string;
  language?: string;
  /** ISO-like string from Meta when requested on template list/read. */
  last_updated_time?: string;
  /** Present on some Graph versions; may be omitted. */
  created_time?: string;
  components?: Array<{
    type?: string;
    text?: string;
    format?: string;
    /** Meta sample data for preview (body_text, header_handle, header_text, …). */
    example?: {
      body_text?: string[][];
      header_handle?: string[];
      header_text?: string[][];
    };
    /** `BUTTONS` component from Graph. */
    buttons?: Array<{ type?: string; text?: string; url?: string; phone_number?: string; example?: unknown }>;
  }>;
  rejected_reason?: string;
  /** Enriched server-side from Meta `template_analytics` (list endpoint, ~30 hari). */
  _template_analytics?: {
    messages_delivered?: number;
    messages_read?: number;
  };
};

export type TemplatePaging = {
  cursors?: { before?: string; after?: string };
  next?: string;
};

export type TemplateListResponse = {
  data: MetaMessageTemplate[];
  paging: TemplatePaging | null;
};

/** Normalized row for CRM table + filters. */
export type TemplateTableRow = {
  id: string;
  templateName: string;
  /** Single-line snippet for table cells (truncated). */
  bodyPreview: string;
  /** Full BODY `text` from Meta for detail / phone preview. */
  bodyFull: string;
  /** HEADER text when format is TEXT (or implicit text); null if media-only header or absent. */
  headerText: string | null;
  footerText: string | null;
  /** Labels for BUTTONS row in phone preview (order preserved). */
  previewButtonLabels: string[];
  /** BODY `example.body_text[0]` from Meta — sample values for `{{1}}`, `{{2}}`, … */
  bodyVariableExamples: string[];
  /** HEADER `example.header_text[0]` for text headers with variables. */
  headerVariableExamples: string[];
  /** Public `https` URL from HEADER `example.header_handle` when Meta returns one; opaque handles → null. */
  headerMediaPreviewUrl: string | null;
  categoryDisplay: string;
  categoryFilter: string;
  /** Raw `language` from Meta (trimmed), or "—". */
  languageCode: string;
  /** Compact tag derived from Meta `language` only (e.g. `ID`, `EN-US`), not a friendly-name map. */
  languageLabel: string;
  statusLabel: string;
  statusRaw: string;
  /** Human label from Meta `quality_score.score` (e.g. High quality); "—" when not applicable. */
  qualityLabel: string;
  /** Raw Meta quality score enum (`GREEN`, `YELLOW`, `RED`, `UNKNOWN`) or empty. */
  qualityRaw: string;
  /** False when Meta did not return `quality_score` / `quality_rating` on the template payload. */
  qualityFromMeta: boolean;
  messagesDelivered: number | null;
  readRatePercent: number | null;
  topBlockReason: string | null;
  /** Meta `created_time` when returned; else `last_updated_time` if Meta omits `created_time`. */
  createdAt: Date | null;
  lastEditedAt: Date | null;
  /** HEADER `format` from Meta (`IMAGE` | `VIDEO` | `DOCUMENT`) when template has media header; else null. */
  mediaFormat: string | null;
};

/** `all` = no date window (show every template that passes other filters). */
export type DateRangePreset = "all" | "7" | "30" | "60" | "90";

export const STATUS_FILTER_OPTIONS = [
  "Approved",
  "Appealed – In review",
  "Paused",
  "In review",
  "Rejected",
  "Archived",
  "Disabled",
] as const;

export type StatusFilterOption = (typeof STATUS_FILTER_OPTIONS)[number];

export const QUALITY_FILTER_OPTIONS = [
  "High quality",
  "Medium quality",
  "Low quality",
  "Quality pending",
] as const;

export type QualityFilterOption = (typeof QUALITY_FILTER_OPTIONS)[number];

/** Local editor model for Meta template `BUTTONS` component (Graph / Business Management API). */
export type QuickReplyVariant = "custom" | "prefilled";

/** Flow CTA icon — maps to Graph `icon` on FLOW buttons (see Meta message template components / pywa FlowButtonIcon). */
export type FlowTemplateButtonIcon = "DEFAULT" | "DOCUMENT" | "PROMOTION" | "REVIEW";

/** Mirrors Meta: create flow in Manager vs paste existing Flow ID. */
export type FlowEntryMode = "create_new" | "existing";

export type WizardTemplateButton =
  | { id: string; kind: "QUICK_REPLY"; text: string; quickReplyVariant?: QuickReplyVariant }
  | { id: string; kind: "URL"; text: string; url: string; urlExample: string }
  | { id: string; kind: "PHONE_NUMBER"; text: string; phoneNumber: string }
  | {
      id: string;
      kind: "FLOW";
      text: string;
      flowId: string;
      flowAction: "navigate" | "data_exchange";
      navigateScreen: string;
      flowIcon: FlowTemplateButtonIcon;
      flowEntryMode: FlowEntryMode;
    }
  | { id: string; kind: "COPY_CODE"; offerExample: string }
  | { id: string; kind: "VOICE_CALL"; text: string };
