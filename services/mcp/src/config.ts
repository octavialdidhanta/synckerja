export type McpServiceConfig = {
  publicUrl: string;
  officeOrigin: string;
  jwtSecret: string;
  port: number;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
};

type Env = Record<string, string | undefined>;

function readEnv(): Env {
  const proc = (globalThis as { process?: { env?: Env } }).process;
  return proc?.env ?? {};
}

function trimOrigin(value: string): string {
  return value.replace(/\/+$/, "");
}

export function loadConfig(): McpServiceConfig {
  const env = readEnv();
  const publicUrl = trimOrigin(env.MCP_PUBLIC_URL || "http://localhost:8787");
  const officeOrigin = trimOrigin(env.OFFICE_ORIGIN || "http://localhost:8080");
  const jwtSecret = env.MCP_JWT_SECRET || "";
  const supabaseUrl = env.SUPABASE_URL || "";
  const supabaseServiceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || "";
  const port = Number(env.PORT || 8787);

  if (jwtSecret.length < 16) {
    throw new Error("MCP_JWT_SECRET must be at least 16 characters");
  }
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error("PORT must be a positive number");
  }

  return { publicUrl, officeOrigin, jwtSecret, port, supabaseUrl, supabaseServiceRoleKey };
}

export function mcpResourceUrl(config: Pick<McpServiceConfig, "publicUrl">): string {
  return `${config.publicUrl}/mcp`;
}
