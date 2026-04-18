/** Raw item from Meta `message_templates` list (subset). */
export type MetaMessageTemplate = {
  id?: string;
  name?: string;
  status?: string;
  category?: string;
  language?: string;
  components?: Array<{ type?: string; text?: string; format?: string }>;
  rejected_reason?: string;
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
  bodyPreview: string;
  categoryDisplay: string;
  categoryFilter: string;
  languageCode: string;
  languageLabel: string;
  languagePreview: string;
  statusLabel: string;
  statusRaw: string;
  messagesDelivered: number | null;
  readRatePercent: number | null;
  topBlockReason: string | null;
  lastEditedAt: Date | null;
};

export type DateRangePreset = "7" | "30" | "60" | "90";

export const STATUS_FILTER_OPTIONS = [
  "Active – High quality",
  "Active – Low quality",
  "Active – Quality pending",
  "Active – Medium quality",
  "Appealed – In review",
  "Paused",
  "In review",
  "Rejected",
  "Archived",
  "Disabled",
] as const;

export type StatusFilterOption = (typeof STATUS_FILTER_OPTIONS)[number];

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
