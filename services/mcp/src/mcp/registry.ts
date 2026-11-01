import {
  ADS_PAGE_PATHS,
  CALENDAR_PAGE_PATH,
  CONTENT_PAGE_PATH,
  EMPLOYEES_PAGE_PATH,
  EXPENSES_PAGE_PATH,
  INCOME_PAGE_PATH,
  DAILY_TASK_PAGE_PATH,
  HABITS_PAGE_PATH,
  INVENTORY_PAGE_PATH,
  PAYROLL_PAGE_PATH,
  POS_SALES_SUMMARY_PAGE_PATH,
  KOL_CAMPAIGNS_PAGE_PATH,
  KOL_PROFILES_PAGE_PATH,
  LEADS_PAGE_PATH,
  LEAD_MAGNET_PAGE_PATH,
  THINKING_LAB_PAGE_PATH,
  OKR_PAGE_PATH,
  VISITS_PAGE_PATH,
  type McpModuleKey,
} from "../authz/context";

export type McpToolName =
  | "session.whoami"
  | "content.plans.list"
  | "content.calendar.list"
  | "content.catalog.list"
  | "okr.cycles.list"
  | "okr.objectives.list"
  | "okr.departments.list"
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
  | "content.briefs.create"
  | "content.plans.update"
  | "okr.objectives.create"
  | "okr.objectives.update"
  | "okr.objectives.department.create"
  | "okr.objectives.individual.create"
  | "crm.leads.create"
  | "crm.leads.update"
  | "content.plans.schedule"
  | "leadmagnet.draft.read"
  | "leadmagnet.delivery.attach"
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
  | "tasks.objective.link"
  | "tasks.initiative.take"
  | "tasks.steps.list"
  | "tasks.steps.create"
  | "tasks.steps.update"
  | "tasks.steps.delete"
  | "habits.list"
  | "habits.check"
  | "thinking.ideas.list"
  | "thinking.chain.read"
  | "thinking.execution.check"
  | "thinking.plan.save"
  | "thinking.plan.direct";

export type McpTool = {
  name: McpToolName;
  description: string;
  scopes: string[];
  moduleKey?: McpModuleKey;
  pagePath?: string;
  pagePaths?: readonly string[];
  pagePathsAll?: readonly string[];
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
    name: "content.catalog.list",
    description:
      "List the content types, categories, subcategories, and features that can be assigned to a content plan in the organization locked in this session. Returns kind, id, name, service_id, and sub_service_id. Kinds are type, service, sub_service, and feature. Feature descriptions are not returned.",
    scopes: ["content:read"],
    moduleKey: "digitalMarketing",
    pagePath: CONTENT_PAGE_PATH,
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
      "List up to 50 company, department, and individual objectives for the organization locked in this session. Optional cycle_id limits the rows to one cycle. Returns id, level, title, status, progress percentage, cycle id, a display name, parent id, department id, department name, and employee id. Key result numbers are not included.",
    scopes: ["okr:read"],
    moduleKey: "okr",
    pagePath: OKR_PAGE_PATH,
  },
  {
    name: "okr.departments.list",
    description:
      "List up to 50 active departments for the organization locked in this session. Returns id and name. Descriptions are not returned.",
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
      "Create a draft content plan for the organization locked in this session. Requires a title. Optional post_date is YYYY-MM-DD in Asia/Jakarta, and brief is an optional short note of at most 4000 characters. The signed-in member becomes the PIC. A storyboard table, concept, and caption are created with content.briefs.create, not with this brief field. Approval, production, and publish fields stay at their defaults.",
    scopes: ["content:write"],
    moduleKey: "digitalMarketing",
    pagePath: CONTENT_PAGE_PATH,
  },
  {
    name: "content.briefs.create",
    description:
      "Create one content plan with a storyboard table, optional concept, and optional caption for the organization locked in this session. The same table is used for Carousel, Post, Reel, Story, Youtube, and any other active content type. Requires a title, content_type_id, and at least one sequence of shots. Call content.catalog.list first and pass those ids. Optional service_id, sub_service_id, and feature_id must belong to this organization. A subcategory must belong to the selected category. A feature locked to one subcategory selects that subcategory. Optional post_date is YYYY-MM-DD in Asia/Jakarta. Each shot has timing, visual, vo, element, and tagging. Carousel timing is Slide 1, Slide 2, and so on. Reel and Story timing is seconds. Youtube timing is chapters. A Post is usually one shot. The visual field is a scene description. The image cell stays empty because images are added in Office. post_aspect is 4:5 or 1:1 and is stored only for Post and Carousel. Optional characters, locations, and properties are a name plus a description. Optional voice_over and caption are plain text. The signed-in member becomes the PIC. Does not approve, schedule, upload an image, or set a Drive link or a published link.",
    scopes: ["content:write"],
    moduleKey: "digitalMarketing",
    pagePath: CONTENT_PAGE_PATH,
  },
  {
    name: "content.plans.update",
    description:
      "Update the title, post date, or short brief of one content plan in the organization locked in this session. The brief stays at most 4000 characters. A brief change is accepted when the signed-in member is that plan's PIC. If the plan has no PIC yet, that member becomes the PIC. A storyboard belongs in content.briefs.create. Does not change approval, production status, completion, or published links.",
    scopes: ["content:write"],
    moduleKey: "digitalMarketing",
    pagePath: CONTENT_PAGE_PATH,
  },
  {
    name: "okr.objectives.create",
    description:
      "Create a company objective in one cycle for the organization locked in this session. Requires cycle_id and title. Status is draft or active. Progress stays at zero. A percentage key result from 0 to 100 is stored on the company objective. A department key result is created separately with okr.objectives.department.create.",
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
    name: "okr.objectives.department.create",
    description:
      "Create a department objective under one company objective for the organization locked in this session. This is the key result a department carries for that company objective. Requires company_objective_id, department_id, and title. The cycle is copied from the company objective. Progress stays at zero. A percentage key result is stored on the department objective. Does not create an individual objective or a task.",
    scopes: ["okr:write"],
    moduleKey: "okr",
    pagePath: OKR_PAGE_PATH,
  },
  {
    name: "okr.objectives.individual.create",
    description:
      "Create an individual objective under one department objective for the organization locked in this session. This is the key result one employee carries for that department objective. Requires department_objective_id and title. Optional employee_id assigns another person only for an owner, admin, or hr member; omit it to use the signed-in member. The employee must belong to that department. The cycle is copied from the department objective. Progress stays at zero. A percentage key result is stored on the individual objective. Does not create a task.",
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
    name: "leadmagnet.draft.read",
    description:
      "Read up to 30 draft lead-magnet campaigns for the organization locked in this session. Optional campaign_id reads one draft. Returns the name, target market, comment keyword, reply text, follow text, offer text, delivery text, and whether a delivery file is already stored. Judge in the chat whether the offer, keyword, and messages are clear. Do not save a PDF until the user gives an https link. Account ids, tokens, and sent messages are not returned.",
    scopes: ["content:read"],
    moduleKey: "digitalMarketing",
    pagePath: LEAD_MAGNET_PAGE_PATH,
  },
  {
    name: "leadmagnet.delivery.attach",
    description:
      "Store one https PDF as the delivery file of one draft lead-magnet campaign in the organization locked in this session. Requires campaign_id and file_url. The file must be a PDF of at most 25 MB. Redirects are not followed. Does not change the campaign status, account, keyword, or message text, and does not send a comment or a DM.",
    scopes: ["content:write"],
    moduleKey: "digitalMarketing",
    pagePath: LEAD_MAGNET_PAGE_PATH,
  },
  {
    name: "thinking.ideas.list",
    description:
      "List up to 30 Ideas that already passed and are locked in Thinking Lab for the organization locked in this session. Returns the id, Idea sentence, Master Thought sentence, and Angle sentence. Does not create or change the tree.",
    scopes: ["content:read"],
    moduleKey: "digitalMarketing",
    pagePath: THINKING_LAB_PAGE_PATH,
  },
  {
    name: "thinking.chain.read",
    description:
      "Read one locked, passed Idea and its Master Thought chain for the organization locked in this session. Returns the Master Thought, its subject when stored, the Big Thought, Territory, Angle, Idea, and active content pillars. Existing executions return only id, pillar name, title, and whether they passed. Image paths, keys, and judge prompts are not returned. If the user has not chosen a path, use thinking.execution.check next.",
    scopes: ["content:read"],
    moduleKey: "digitalMarketing",
    pagePath: THINKING_LAB_PAGE_PATH,
  },
  {
    name: "thinking.execution.check",
    description:
      "Check a structured script for one locked, passed Idea against the Thinking Lab rules for the organization locked in this session. Requires idea_id, content_pillar_id, and the script. Stops at the first failed check and does not save. When every active check passes, saves the Execution and returns execution_id with passed true. Does not create a content plan. Use this path unless the user explicitly chooses to save a plan directly.",
    scopes: ["content:write"],
    moduleKey: "digitalMarketing",
    pagePath: THINKING_LAB_PAGE_PATH,
  },
  {
    name: "thinking.plan.save",
    description:
      "Save a draft content plan from one Thinking Lab Execution that already passed, for the organization locked in this session. Requires execution_id and content_type_id. Optional service_id, sub_service_id, feature_id, and post_date. The signed-in member becomes PIC. Does not approve, schedule, publish, or create a lead-magnet campaign.",
    scopes: ["content:write"],
    moduleKey: "digitalMarketing",
    pagePathsAll: [THINKING_LAB_PAGE_PATH, CONTENT_PAGE_PATH],
  },
  {
    name: "thinking.plan.direct",
    description:
      "Save a draft content plan directly from one locked, passed Idea when the user explicitly chooses to skip the Thinking Lab check. Requires idea_id, content_pillar_id, content_type_id, and a structured script. Optional service_id, sub_service_id, feature_id, and post_date. Does not write an Execution and does not mark anything passed. The signed-in member becomes PIC. Does not approve, schedule, publish, or create a lead-magnet campaign. Call this only after the user explicitly chooses the direct path.",
    scopes: ["content:write"],
    moduleKey: "digitalMarketing",
    pagePathsAll: [THINKING_LAB_PAGE_PATH, CONTENT_PAGE_PATH],
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
      "List up to 30 daily tasks for the organization locked in this session. Optional status is pending, in_progress, completed, or cancelled. Optional month is YYYY-MM and keeps only tasks whose plan month is that month; tasks with no plan month are left out. Omit month for the latest tasks of any month. Returns id, title, status, priority, plan month, due date, assignee name, and creator name. A November plan with a December due date stays in November. Descriptions, comments, and files are not returned.",
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
      "Create one pending daily task for the organization locked in this session. Required arguments: title and plan_month. plan_month is text like 2026-11. It is the Office month bucket, stored as the first day of that month, and can differ from due_date, for example plan_month 2026-11 with due_date 2026-12-02. Optional: description, priority, due_date, employee_id. Status stays pending. Does not upload a file or add a comment.",
    scopes: ["tasks:write"],
    moduleKey: "tools",
    pagePath: DAILY_TASK_PAGE_PATH,
  },
  {
    name: "tasks.update",
    description:
      "Update the title, priority, due date, or plan_month of one daily task in the organization locked in this session. plan_month is text like 2026-12. Omit plan_month to leave the saved month unchanged. A plan month and a due date in different months stay as sent. Does not change its status, so completion approval is not bypassed.",
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
    name: "tasks.objective.link",
    description:
      "Link one daily task to one individual objective in the organization locked in this session. Requires task_id and individual_objective_id. Does not change the task status, steps, or OKR progress, and does not create a task.",
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
  {
    name: "tasks.steps.list",
    description:
      "List up to 50 steps of one daily task in the organization locked in this session. Returns id, title, order, whether it is completed, and the assignee name. A blank assignee means nobody is assigned. Descriptions, comments, and files are not returned.",
    scopes: ["tasks:read"],
    moduleKey: "tools",
    pagePath: DAILY_TASK_PAGE_PATH,
  },
  {
    name: "tasks.steps.create",
    description:
      "Add one unfinished step to a daily task in the organization locked in this session. Requires the task id and a title. The step is placed after the current last step. Does not mark the task completed and does not upload a file.",
    scopes: ["tasks:write"],
    moduleKey: "tools",
    pagePath: DAILY_TASK_PAGE_PATH,
  },
  {
    name: "tasks.steps.update",
    description:
      "Rename one step of a daily task in the organization locked in this session. Does not change completion, status, assignee, or due date.",
    scopes: ["tasks:write"],
    moduleKey: "tools",
    pagePath: DAILY_TASK_PAGE_PATH,
  },
  {
    name: "tasks.steps.delete",
    description:
      "Delete one step of a daily task in the organization locked in this session. Refuses when the step or one of its substeps is assigned, or when the step is linked to a content plan. Unassigned substeps of that step are removed with it.",
    scopes: ["tasks:write"],
    moduleKey: "tools",
    pagePath: DAILY_TASK_PAGE_PATH,
  },
  {
    name: "habits.list",
    description:
      "List the signed-in member's habits that are scheduled on one day. Optional date is YYYY-MM-DD in Asia/Jakarta; omit it for today. Returns the habit name, frequency, target, and each checklist item with its index, name, and whether it is checked. Other people's habits are not returned.",
    scopes: ["habits:read"],
    moduleKey: "tools",
    pagePath: HABITS_PAGE_PATH,
  },
  {
    name: "habits.check",
    description:
      "Check or uncheck one item of the signed-in member's habit on one day. Optional date is YYYY-MM-DD in Asia/Jakarta; omit it for today. Index is required when the habit has more than one checklist item. Does not change another person's habit, create a habit, or move a monthly date.",
    scopes: ["habits:write"],
    moduleKey: "tools",
    pagePath: HABITS_PAGE_PATH,
  },
];
