export type CatalogOption = {
  id: string;
  label: string;
};

export type AngleIdeaOption = {
  id: string;
  code: string;
  name: string;
  statement: string;
};

export type AngleOption = CatalogOption & {
  master: string;
  code: string;
  name: string;
  statement: string;
  serviceId: string | null;
  ideas: AngleIdeaOption[];
  pillarIds: string[];
  otherIdeaCount: number;
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
  angleIds: string[];
  repeatVoices: string[];
  splitRule: string;
  subServiceId: string | null;
  contentPlanAutoApprove: boolean;
};

export type SubServiceOption = {
  id: string;
  name: string;
  serviceId: string;
};

export type ScheduleRow = {
  sopCode: string;
  cadence: "days" | "weekly" | "monthly";
  weekday: number | null;
  weekdays: number[];
  planCount: number;
  startLocal: string;
  startTimes: string[];
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
  references: BriefReference[];
  brandColorId: string | null;
  companyLogoId: string | null;
  brandColors: CatalogBrandColor[];
  companyLogos: CatalogCompanyLogo[];
  subServices: SubServiceOption[];
  briefLabels: {
    services: CatalogOption[];
    personas: CatalogOption[];
    pillars: CatalogOption[];
    products: CatalogOption[];
    angles: CatalogOption[];
  };
  options: {
    services: CatalogOption[];
    personas: CatalogOption[];
    pillars: CatalogOption[];
    products: ProductOption[];
    angles: AngleOption[];
  };
  quota: AiEmployeeQuota;
};

export type BriefReference = {
  position: number;
  storagePath: string;
};

export type CatalogBrandColor = {
  id: string;
  brandName: string;
  primary: string;
  secondary: string;
  accent: string;
};

export type CatalogCompanyLogo = {
  id: string;
  brandName: string;
  logoPath: string;
};

export type BriefChange = {
  label: string;
  before: string;
  after: string;
};
