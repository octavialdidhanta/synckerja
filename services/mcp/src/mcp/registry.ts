import {
  ADS_PAGE_PATHS,
  CALENDAR_PAGE_PATH,
  CONTENT_PAGE_PATH,
  EMPLOYEES_PAGE_PATH,
  EXPENSES_PAGE_PATH,
  INCOME_PAGE_PATH,
  DAILY_TASK_PAGE_PATH,
  INVENTORY_PAGE_PATH,
  PAYROLL_PAGE_PATH,
  POS_SALES_SUMMARY_PAGE_PATH,
  KOL_CAMPAIGNS_PAGE_PATH,
  KOL_PROFILES_PAGE_PATH,
  LEADS_PAGE_PATH,
  OKR_PAGE_PATH,
  VISITS_PAGE_PATH,
  type McpModuleKey,
} from "../authz/context";

export type McpToolName =
  | "session.whoami"
  | "content.plans.list"
  | "content.calendar.list"
  | "okr.cycles.list"
  | "okr.objectives.list"
  | "crm.leads.list"
  | "ads.accounts.list"
  | "finance.income.list"
  | "finance.income.create"
  | "finance.income.update"
  | "finance.expenses.list"
  | "finance.expenses.create"
  | "finance.expenses.update"
  | "hr.employees.list"
  | "payroll.runs.list"
  | "sales.visits.list"
  | "pos.sales.daily"
  | "kol.campaigns.list"
  | "kol.profiles.list"
  | "inventory.stock.list"
  | "content.plans.create"
  | "content.plans.update"
  | "okr.objectives.create"
  | "okr.objectives.update"
  | "crm.leads.create"
  | "crm.leads.update"
  | "content.plans.schedule"
  | "crm.leads.setStatus"
  | "tasks.summary"
  | "tasks.list"
  | "tasks.initiative.list"
  | "tasks.workload"
  | "tasks.completed.list"
  | "tasks.create"
  | "tasks.update"
  | "tasks.delete"
  | "tasks.assign"
  | "tasks.initiative.take";

export type McpTool = {
  name: McpToolName;
  description: string;
  scopes: string[];
  moduleKey?: McpModuleKey;
  pagePath?: string;
  pagePaths?: readonly string[];
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
  {
    name: "ads.accounts.list",
    description:
      "List connected Google, Meta, and TikTok ad accounts for the organization locked in this session. Returns platform, label, account id, whether the account is active, whether the last connection test succeeded, and when it was connected. Access tokens, page tokens, and ad spend are not returned.",
    scopes: ["ads:read"],
    moduleKey: "digitalMarketing",
    pagePaths: ADS_PAGE_PATHS,
  },
  {
    name: "finance.income.list",
    description:
      "List up to 50 income transactions for the organization locked in this session. Optional month is YYYY-MM in Asia/Jakarta; omit it for the current month. Returns id, date, amount, customer name, payment method, and status. Receipt files and bank accounts are not returned.",
    scopes: ["finance:read"],
    moduleKey: "finance",
    pagePath: INCOME_PAGE_PATH,
  },
  {
    name: "finance.income.create",
    description:
      "Record one income transaction for the organization locked in this session. Requires a transaction date and an amount. Optional customer name, payment method, and description. Status stays pending. Does not mark it paid, attach a bank account, or upload a receipt. Bank transfer is rejected.",
    scopes: ["finance:write"],
    moduleKey: "finance",
    pagePath: INCOME_PAGE_PATH,
  },
  {
    name: "finance.income.update",
    description:
      "Update the date, amount, customer, payment method, or description of one pending income transaction that has no bank account, deposit confirmation, or allocation. Does not mark it paid, change the bank account, or upload a receipt.",
    scopes: ["finance:write"],
    moduleKey: "finance",
    pagePath: INCOME_PAGE_PATH,
  },
  {
    name: "finance.expenses.list",
    description:
      "List up to 50 expenses for the organization locked in this session. Optional month is YYYY-MM in Asia/Jakarta; omit it for the current month. Returns id, name, amount, type, category, create date, and status. Receipts and bank accounts are not returned.",
    scopes: ["finance:read"],
    moduleKey: "finance",
    pagePath: EXPENSES_PAGE_PATH,
  },
  {
    name: "finance.expenses.create",
    description:
      "Record one expense for the organization locked in this session. Requires a name, amount, date, expense type, and category. Status stays active. Does not pay it, attach a bank account or wallet, or upload a receipt.",
    scopes: ["finance:write"],
    moduleKey: "finance",
    pagePath: EXPENSES_PAGE_PATH,
  },
  {
    name: "finance.expenses.update",
    description:
      "Update the name, amount, date, type, category, or description of one active expense that is not paid from a bank, wallet, or debt and is not a payroll, recurring, or purchase-request row. Does not pay it or delete it.",
    scopes: ["finance:write"],
    moduleKey: "finance",
    pagePath: EXPENSES_PAGE_PATH,
  },
  {
    name: "hr.employees.list",
    description:
      "List up to 50 employees for the organization locked in this session. Terminated and inactive employees come last. Returns id, full name, status, department, and job level. Email, phone, salary, bank details, and identity documents are not returned.",
    scopes: ["hr:read"],
    moduleKey: "humanResources",
    pagePath: EMPLOYEES_PAGE_PATH,
  },
  {
    name: "payroll.runs.list",
    description:
      "List up to 20 payroll runs for the organization locked in this session. Optional month is YYYY-MM and matches the period start date; omit it for the 20 newest runs. Returns id, run name, period name, start date, end date, status, employee count, and total net pay. Employee names, gross pay, tax, deductions, notes, and bank details are not returned.",
    scopes: ["payroll:read"],
    moduleKey: "humanResources",
    pagePath: PAYROLL_PAGE_PATH,
  },
  {
    name: "sales.visits.list",
    description:
      "List up to 50 store visits for the organization locked in this session. Optional month is YYYY-MM in Asia/Jakarta; omit it for the current month. Returns id, visit date, status, match status, lookup kind, and the matched lead client name. Phone numbers and visit notes are not returned.",
    scopes: ["sales:read"],
    moduleKey: "operations",
    pagePath: VISITS_PAGE_PATH,
  },
  {
    name: "pos.sales.daily",
    description:
      "List daily store-checkout totals for the organization locked in this session. Optional month is YYYY-MM in Asia/Jakarta; omit it for the current month. Returns up to 31 days that have sales: the date, transaction count, and total collected. Days without sales are omitted. Line items, customer phone numbers, payment methods, and cashier pins are not returned.",
    scopes: ["pos:read"],
    moduleKey: "operations",
    pagePath: POS_SALES_SUMMARY_PAGE_PATH,
  },
  {
    name: "kol.campaigns.list",
    description:
      "List up to 50 KOL campaigns for the organization locked in this session. Returns id, name, status, start date, end date, and budget figures.",
    scopes: ["kol:read"],
    moduleKey: "digitalMarketing",
    pagePath: KOL_CAMPAIGNS_PAGE_PATH,
  },
  {
    name: "kol.profiles.list",
    description:
      "List up to 50 KOL profiles for the organization locked in this session. Returns id, name, status, category, follower count, and engagement rate. Email, phone, notes, and photos are not returned.",
    scopes: ["kol:read"],
    moduleKey: "digitalMarketing",
    pagePath: KOL_PROFILES_PAGE_PATH,
  },
  {
    name: "inventory.stock.list",
    description:
      "List up to 50 stock rows for the organization locked in this session, lowest available quantity first. Returns product name, SKU name, internal SKU, available quantity, and reserved quantity. Movement history is not returned.",
    scopes: ["commerce:read"],
    moduleKey: "operations",
    pagePath: INVENTORY_PAGE_PATH,
  },
  {
    name: "content.plans.create",
    description:
      "Create a draft content plan for the organization locked in this session. Requires a title. Optional post_date is YYYY-MM-DD in Asia/Jakarta, and brief is optional. Approval, production, and publish fields stay at their defaults.",
    scopes: ["content:write"],
    moduleKey: "digitalMarketing",
    pagePath: CONTENT_PAGE_PATH,
  },
  {
    name: "content.plans.update",
    description:
      "Update the title, post date, or brief of one content plan in the organization locked in this session. A brief change is accepted only when the signed-in member is that plan's PIC. Does not change approval, production status, completion, or published links.",
    scopes: ["content:write"],
    moduleKey: "digitalMarketing",
    pagePath: CONTENT_PAGE_PATH,
  },
  {
    name: "okr.objectives.create",
    description:
      "Create a company objective in one cycle for the organization locked in this session. Requires cycle_id and title. Status is draft or active. Progress stays at zero. Department and individual objectives are not created.",
    scopes: ["okr:write"],
    moduleKey: "okr",
    pagePath: OKR_PAGE_PATH,
  },
  {
    name: "okr.objectives.update",
    description:
      "Update the title or status of one company, department, or individual objective in the organization locked in this session. Status is draft, active, completed, or cancelled. Progress, weight, cycle, and owner stay unchanged.",
    scopes: ["okr:write"],
    moduleKey: "okr",
    pagePath: OKR_PAGE_PATH,
  },
  {
    name: "crm.leads.create",
    description:
      "Create a lead for the organization locked in this session. Requires client, title, and category. Optional source, follow-up priority, and status name. Does not accept a phone number or email. Converted, closed, and resolve statuses are rejected. The assignee is the signed-in member.",
    scopes: ["crm:write"],
    moduleKey: "omnichannel",
    pagePath: LEADS_PAGE_PATH,
  },
  {
    name: "crm.leads.update",
    description:
      "Update the client, title, category, source, or follow-up priority of one lead in the organization locked in this session. Does not change status, assignee, ticket id, phone number, or email.",
    scopes: ["crm:write"],
    moduleKey: "omnichannel",
    pagePath: LEADS_PAGE_PATH,
  },
  {
    name: "content.plans.schedule",
    description:
      "Schedule one already eligible content plan for the organization locked in this session. The plan must already be approved, production-approved, a Reel, and have a post date plus a Google Drive file link. Does not approve the plan, publish it now, or delete a published post.",
    scopes: ["content:publish"],
    moduleKey: "digitalMarketing",
    pagePath: CONTENT_PAGE_PATH,
  },
  {
    name: "crm.leads.setStatus",
    description:
      "Set the status of one lead in the organization locked in this session and copy that status onto the linked conversation. Does not send a chat message. Converted, closed, and resolve are rejected. Assignee, phone number, and email stay unchanged.",
    scopes: ["crm:write"],
    moduleKey: "omnichannel",
    pagePath: LEADS_PAGE_PATH,
  },
  {
    name: "tasks.summary",
    description:
      "Count daily tasks for the organization locked in this session. Optional month is YYYY-MM in Asia/Jakarta; omit it for the current month. Returns pending, in progress, completed, cancelled, and overdue counts. Overdue means an unfinished task whose due date has passed.",
    scopes: ["tasks:read"],
    moduleKey: "tools",
    pagePath: DAILY_TASK_PAGE_PATH,
  },
  {
    name: "tasks.list",
    description:
      "List up to 30 daily tasks for the organization locked in this session. Optional status is pending, in_progress, completed, or cancelled. Returns id, title, status, priority, due date, assignee name, and creator name. Descriptions, comments, and files are not returned.",
    scopes: ["tasks:read"],
    moduleKey: "tools",
    pagePath: DAILY_TASK_PAGE_PATH,
  },
  {
    name: "tasks.initiative.list",
    description:
      "List up to 50 unfinished daily-task items that someone can take. Each row is a task, step, or substep, with its parent task title, priority, due date, and the name of the person who already took it. A blank assignee means nobody has taken it yet.",
    scopes: ["tasks:read"],
    moduleKey: "tools",
    pagePath: DAILY_TASK_PAGE_PATH,
  },
  {
    name: "tasks.workload",
    description:
      "Show who is busy or idle on daily tasks for the organization locked in this session. Optional timeframe is day, week, or month in Asia/Jakarta; omit it for the current Monday-Sunday week. Overdue work outside the range still counts. Returns up to 50 active employees with name, active assignment count, whether they are idle, and the longest wait in days. Email and phone are not returned.",
    scopes: ["tasks:read"],
    moduleKey: "tools",
    pagePath: DAILY_TASK_PAGE_PATH,
  },
  {
    name: "tasks.completed.list",
    description:
      "List up to 20 recently completed daily-task steps for the organization locked in this session. Optional month is YYYY-MM in Asia/Jakarta; omit it for the latest completions. Returns the task title, step title, completion time, and assignee name.",
    scopes: ["tasks:read"],
    moduleKey: "tools",
    pagePath: DAILY_TASK_PAGE_PATH,
  },
  {
    name: "tasks.create",
    description:
      "Create one pending daily task for the organization locked in this session. Requires a title. Optional description, priority, due date, and assignee. Status stays pending. Does not upload a file or add a comment.",
    scopes: ["tasks:write"],
    moduleKey: "tools",
    pagePath: DAILY_TASK_PAGE_PATH,
  },
  {
    name: "tasks.update",
    description:
      "Update the title, priority, or due date of one daily task in the organization locked in this session. Does not change its status, so completion approval is not bypassed.",
    scopes: ["tasks:write"],
    moduleKey: "tools",
    pagePath: DAILY_TASK_PAGE_PATH,
  },
  {
    name: "tasks.delete",
    description:
      "Delete one daily task in the organization locked in this session. Refuses when the task or one of its steps is already assigned.",
    scopes: ["tasks:write"],
    moduleKey: "tools",
    pagePath: DAILY_TASK_PAGE_PATH,
  },
  {
    name: "tasks.assign",
    description:
      "Assign one daily task to an employee in the organization locked in this session and optionally set its due date. Replaces the previous assignee. Owners, admins, and HR may assign another person. Other members may assign only themselves.",
    scopes: ["tasks:write"],
    moduleKey: "tools",
    pagePath: DAILY_TASK_PAGE_PATH,
  },
  {
    name: "tasks.initiative.take",
    description:
      "Take one unfinished daily-task item and set its due date. The level is task, step, or substep. Replaces the previous assignee. Owners, admins, and HR may choose another employee. Other members take it for themselves.",
    scopes: ["tasks:write"],
    moduleKey: "tools",
    pagePath: DAILY_TASK_PAGE_PATH,
  },
];
