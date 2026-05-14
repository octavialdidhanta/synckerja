export type RecipientUploadStatus = "draft" | "completed" | "processing" | "failed";
export type RecipientSource = "file_upload" | "contacts";

export type RecipientListRow = {
  id: string;
  name: string;
  channel: string;
  contacts: number;
  uploadStatus: RecipientUploadStatus;
  source: RecipientSource;
  createdAt: string;
};

const base = Date.now();

export const MOCK_RECIPIENT_LISTS: RecipientListRow[] = [
  {
    id: "1",
    name: "Q1 Promo — Jakarta",
    channel: "WhatsApp",
    contacts: 12840,
    uploadStatus: "completed",
    source: "file_upload",
    createdAt: new Date(base - 86400000 * 2).toISOString(),
  },
  {
    id: "2",
    name: "VIP customers 2026",
    channel: "WhatsApp",
    contacts: 420,
    uploadStatus: "processing",
    source: "contacts",
    createdAt: new Date(base - 86400000 * 5).toISOString(),
  },
  {
    id: "3",
    name: "Re-engagement batch A",
    channel: "WhatsApp",
    contacts: 9800,
    uploadStatus: "failed",
    source: "file_upload",
    createdAt: new Date(base - 86400000 * 9).toISOString(),
  },
  {
    id: "4",
    name: "Newsletter subscribers",
    channel: "WhatsApp",
    contacts: 2100,
    uploadStatus: "completed",
    source: "contacts",
    createdAt: new Date(base - 86400000 * 12).toISOString(),
  },
  {
    id: "5",
    name: "Partner leads export",
    channel: "WhatsApp",
    contacts: 356,
    uploadStatus: "completed",
    source: "file_upload",
    createdAt: new Date(base - 86400000 * 20).toISOString(),
  },
  {
    id: "6",
    name: "Webinar registrants",
    channel: "WhatsApp",
    contacts: 1890,
    uploadStatus: "processing",
    source: "file_upload",
    createdAt: new Date(base - 86400000 * 25).toISOString(),
  },
  {
    id: "7",
    name: "CSAT follow-up",
    channel: "WhatsApp",
    contacts: 72,
    uploadStatus: "completed",
    source: "contacts",
    createdAt: new Date(base - 86400000 * 30).toISOString(),
  },
  {
    id: "8",
    name: "Black Friday 2025",
    channel: "WhatsApp",
    contacts: 45200,
    uploadStatus: "completed",
    source: "file_upload",
    createdAt: new Date(base - 86400000 * 40).toISOString(),
  },
  {
    id: "9",
    name: "Inactive users — 90d",
    channel: "WhatsApp",
    contacts: 6400,
    uploadStatus: "failed",
    source: "file_upload",
    createdAt: new Date(base - 86400000 * 45).toISOString(),
  },
  {
    id: "10",
    name: "Sales handoff list",
    channel: "WhatsApp",
    contacts: 118,
    uploadStatus: "completed",
    source: "contacts",
    createdAt: new Date(base - 86400000 * 50).toISOString(),
  },
  {
    id: "11",
    name: "Product launch waitlist",
    channel: "WhatsApp",
    contacts: 9034,
    uploadStatus: "processing",
    source: "file_upload",
    createdAt: new Date(base - 86400000 * 55).toISOString(),
  },
  {
    id: "12",
    name: "Regional agents ID",
    channel: "WhatsApp",
    contacts: 512,
    uploadStatus: "completed",
    source: "contacts",
    createdAt: new Date(base - 86400000 * 60).toISOString(),
  },
];
