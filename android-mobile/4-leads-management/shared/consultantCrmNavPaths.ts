/** Shared CRM consultant routes for mobile shell (footer, sidebar, deep links). */
export const CONSULTANT_LIVECHAT_PATH = "/omnichannel/livechat" as const;
export const CONSULTANT_LEADS_MANAGEMENT_PATH = "/omnichannel/leads" as const;

export {
  buildLeadsReportSearch,
  buildLeadsIdleAgentsSearch,
} from "@/5-3-dashboard/leads-report/leadsReportNavigation";
