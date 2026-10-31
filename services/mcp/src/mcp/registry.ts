export type Phase0ToolName = "session.whoami" | "content.plans.list";

export type Phase0Tool = {
  name: Phase0ToolName;
  description: string;
  scopes: string[];
  moduleKey?: "digitalMarketing";
  requiresContentPage?: boolean;
};

export const PHASE0_TOOLS: Phase0Tool[] = [
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
    requiresContentPage: true,
  },
];
