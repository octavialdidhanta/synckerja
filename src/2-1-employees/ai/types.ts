export type CatalogOption = {
  id: string;
  label: string;
};

export type ProductOption = CatalogOption & {
  serviceId: string | null;
  parentServiceId: string | null;
};

export type BriefDraft = {
  serviceIds: string[];
  audience: string;
  personaIds: string[];
  voice: string;
  requiredNotes: string;
  forbiddenNotes: string;
  pillarIds: string[];
  productIds: string[];
  splitRule: string;
};

export type ScheduleRow = {
  sopCode: string;
  cadence: "days" | "weekly" | "monthly";
  weekday: number | null;
  weekdays: number[];
  planCount: number;
  startLocal: string;
  dueLocal: string;
  isActive: boolean;
  nextRunAt: string | null;
};

export type RoutineRow = {
  actionCode: string;
  cadence: "days" | "weekly" | "monthly";
  weekday: number | null;
  weekdays: number[];
  timeLocal: string;
  isActive: boolean;
  nextRunAt: string | null;
  lastSentAt: string | null;
  lastStatus: string | null;
  lastError: string;
  reviewerName: string | null;
  reviewerEmail: string | null;
};

export type AiEmployeeSummary = {
  fullName: string;
  jobTitle: string | null;
  reviewerName: string | null;
  performanceStatus: string | null;
  isActive: boolean | null;
  reportCopyEmail1: string | null;
  reportCopyEmail2: string | null;
  reportSenderName: string | null;
};

export type AiEmployeeKeyResult = {
  code: string;
  title: string;
  currentValue: number | null;
  targetValue: number | null;
  unit: string | null;
  progressPercentage: number | null;
};

export type AiEmployeePlanLink = {
  id: string;
  title: string;
};

export type AiEmployeeRun = {
  id: string;
  startedAt: string | null;
  finishedAt: string | null;
  sopCode: string | null;
  status: string;
  planCount: number;
  note: string;
  plans: AiEmployeePlanLink[];
};

export type AiEmployeeJob = {
  id: string;
  source: string;
  priority: string;
  status: string;
  attempts: number;
  reason: string;
  createdAt: string | null;
  finishedAt: string | null;
};

export type AiEmployeeQuota = {
  usageDate: string;
  used: number;
  cap: number | null;
  remaining: number | null;
  orgUsageDate: string;
  orgUsed: number;
  orgLimit: number;
  orgRemaining: number;
};

export type AiEmployeePageData = {
  organizationId: string;
  canEdit: boolean;
  summary: AiEmployeeSummary;
  keyResults: AiEmployeeKeyResult[];
  runs: AiEmployeeRun[];
  jobs: AiEmployeeJob[];
  schedules: ScheduleRow[];
  routines: RoutineRow[];
  brief: BriefDraft;
  briefLabels: {
    services: CatalogOption[];
    personas: CatalogOption[];
    pillars: CatalogOption[];
    products: CatalogOption[];
  };
  options: {
    services: CatalogOption[];
    personas: CatalogOption[];
    pillars: CatalogOption[];
    products: ProductOption[];
  };
  quota: AiEmployeeQuota;
};

export type BriefChange = {
  label: string;
  before: string;
  after: string;
};
