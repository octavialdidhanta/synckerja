import {
  CALENDAR_PAGE_PATH,
  CONTENT_PAGE_PATH,
  LEADS_PAGE_PATH,
  OKR_PAGE_PATH,
  type McpModuleKey,
} from "../authz/context";

export type McpToolName =
  | "session.whoami"
  | "content.plans.list"
  | "content.calendar.list"
  | "okr.cycles.list"
  | "okr.objectives.list"
  | "crm.leads.list";

export type McpTool = {
  name: McpToolName;
  description: string;
  scopes: string[];
  moduleKey?: McpModuleKey;
  pagePath?: string;
};

export const MCP_TOOLS: McpTool[] = [
  {
    name: "session.whoami",
    description:
      "Return the organization, profile, employee, roles, and OAuth scopes locked to this connector session.",
    scopes: ["session:read"],
  },
  {
    name: "content.plans.list",
    description:
      "List up to 50 content plans for the organization locked in this session. Returns id, title, status, post date, approved, and production status.",
    scopes: ["content:read"],
    moduleKey: "digitalMarketing",
    pagePath: CONTENT_PAGE_PATH,
  },
  {
    name: "content.calendar.list",
    description:
      "List up to 50 content plans whose post date falls in one month for the organization locked in this session. Optional month is YYYY-MM in Asia/Jakarta; omit it for the current month. Returns id, title, status, post date, approved, and production status.",
    scopes: ["content:read"],
    moduleKey: "digitalMarketing",
    pagePath: CALENDAR_PAGE_PATH,
  },
  {
    name: "okr.cycles.list",
    description:
      "List up to 20 OKR cycles for the organization locked in this session. Active cycles come first. Returns id, name, year, quarter, period type, start date, end date, and whether the cycle is active.",
    scopes: ["okr:read"],
    moduleKey: "okr",
    pagePath: OKR_PAGE_PATH,
  },
  {
    name: "okr.objectives.list",
    description:
      "List up to 50 company, department, and individual objectives for the organization locked in this session. Optional cycle_id limits the rows to one cycle. Returns id, level, title, status, progress percentage, cycle id, and a display name. Key results are not included.",
    scopes: ["okr:read"],
    moduleKey: "okr",
    pagePath: OKR_PAGE_PATH,
  },
  {
    name: "crm.leads.list",
    description:
      "List up to 50 leads for the organization locked in this session, newest first. Optional status matches the lead status name, ignoring case. Returns id, ticket id, client, title, source, status, follow-up priority, assignee, and created time. Phone numbers, email addresses, and complaint text are not returned.",
    scopes: ["crm:read"],
    moduleKey: "omnichannel",
    pagePath: LEADS_PAGE_PATH,
  },
];
