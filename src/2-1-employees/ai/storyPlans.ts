/** Story plans list for one AI employee (Fase 3+) — separate from run log / carousel dashboard. */

import type { CanvaStoryRun } from "@/canva/CanvaStoryNote";

export const STORY_PLANS_KEY = "ai-employee-story-plans";

export type StoryPlanCanva = Pick<
  CanvaStoryRun,
  "status" | "design_url" | "error" | "images_ready" | "refresh_requested" | "export_path"
>;

export type StoryPlanRow = {
  id: string;
  postDate: string | null;
  picName: string;
  contentTypeName: string;
  serviceId: string | null;
  serviceName: string;
  pillarName: string;
  briefPreview: string;
  googleDriveLink: string;
  productionStatus: string;
  productionApproved: boolean;
  canva: StoryPlanCanva | null;
};

export type StoryPlans = {
  month: string;
  rows: StoryPlanRow[];
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function canvaOf(value: unknown): StoryPlanCanva | null {
  const row = record(value);
  if (!row) return null;
  return {
    status: text(row.status),
    design_url: text(row.design_url) || null,
    error: text(row.error) || null,
    images_ready: row.images_ready === true,
    refresh_requested: row.refresh_requested === true,
    export_path: text(row.export_path) || null,
  };
}

export function parseStoryPlans(value: unknown): StoryPlans {
  const root = record(value) ?? {};
  const rows = Array.isArray(root.rows) ? root.rows : [];
  return {
    month: text(root.month),
    rows: rows.flatMap((item) => {
      const row = record(item);
      if (!row) return [];
      const id = text(row.id);
      if (!id) return [];
      const serviceId = text(row.service_id);
      return [{
        id,
        postDate: text(row.post_date) || null,
        picName: text(row.pic_name),
        contentTypeName: text(row.content_type_name) || "Story",
        serviceId: serviceId || null,
        serviceName: text(row.service_name),
        pillarName: text(row.pillar_name),
        briefPreview: text(row.brief_preview),
        googleDriveLink: text(row.google_drive_link),
        productionStatus: text(row.production_status),
        productionApproved: row.production_approved === true,
        canva: canvaOf(row.canva),
      }];
    }),
  };
}
