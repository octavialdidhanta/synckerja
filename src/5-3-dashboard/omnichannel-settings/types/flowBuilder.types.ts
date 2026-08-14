export type FlowBuilderStatusFilter = "all" | "active" | "draft";

export type FlowBuilderRowStatus = "ACTIVE" | "DRAFT" | "OTHER";

export type FlowBuilderUserRef = {
  id: string;
  fullName: string;
  email: string;
  orgName?: string;
};

export type FlowBuilderListingRow = {
  id: string;
  name: string;
  status: FlowBuilderRowStatus;
  createdBy: FlowBuilderUserRef | null;
  lastUpdatedBy: FlowBuilderUserRef | null;
  lastUpdatedAt: string | null;
  /** Distinguishes automation flows from Meta WhatsApp Form flows. */
  kind?: "automation" | "meta_form";
};

export type FlowBuilderListingFilters = {
  search: string;
  status: FlowBuilderStatusFilter;
  createdById: string | null;
  updatedById: string | null;
  lastUpdatedDate: Date | null;
};

export type FlowBuilderUserOption = {
  id: string;
  fullName: string;
  email: string;
};

export type MetaWhatsAppFlowApiRow = {
  id?: string;
  name?: string;
  status?: string;
  categories?: string[];
  /** Meta Graph API field (WhatsApp Flow "UpdatedAt"). */
  updated_at?: string | number;
  /** Legacy / mistaken field name — kept for fallback only. */
  updated_time?: string | number;
};
