/**
 * Invoke Supabase MCP deploy_edge_function from a JSON payload file.
 * Usage: node scripts/run-mcp-deploy-payload.mjs scripts/edge-deploy-<name>.json
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const argsPath = process.argv[2];
if (!argsPath) {
  console.error("Usage: node scripts/run-mcp-deploy-payload.mjs <payload.json>");
  process.exit(1);
}

const payload = JSON.parse(fs.readFileSync(path.resolve(argsPath), "utf8"));
const mcpPath = path.join(process.env.USERPROFILE ?? "", ".cursor", "mcp.json");
const cfg = JSON.parse(fs.readFileSync(mcpPath, "utf8"));
const server = cfg?.mcpServers?.supabase ?? cfg?.mcpServers?.["plugin-supabase-supabase"];

if (!server?.command) {
  console.error(JSON.stringify({ error: "supabase MCP server not configured" }));
  process.exit(1);
}

const transport = new StdioClientTransport({
  command: server.command,
  args: server.args ?? [],
  env: { ...process.env, ...(server.env ?? {}) },
});

const client = new Client({ name: "run-mcp-deploy-payload", version: "1.0.0" });

try {
  await client.connect(transport);
  const argumentsPayload = {
    name: payload.name,
    entrypoint_path: payload.entrypoint_path,
    verify_jwt: payload.verify_jwt ?? false,
    files: payload.files,
  };
  if (process.argv.includes("--with-project-id") && payload.project_id) {
    argumentsPayload.project_id = payload.project_id;
  }

  const result = await client.callTool({
    name: "deploy_edge_function",
    arguments: argumentsPayload,
  });

  const textPart = result.content?.find((c) => c.type === "text");
  let parsed = null;
  if (textPart?.text) {
    try {
      parsed = JSON.parse(textPart.text);
    } catch {
      parsed = { raw: textPart.text.slice(0, 2000) };
    }
  }

  console.log(
    JSON.stringify({
      ok: !result.isError,
      isError: result.isError ?? false,
      name: payload.name,
      version: parsed?.version ?? null,
      status: parsed?.status ?? null,
      slug: parsed?.slug ?? payload.name,
      id: parsed?.id ?? null,
      fileCount: payload.files?.length ?? 0,
      error: result.isError ? parsed ?? result : undefined,
    }),
  );
  process.exit(result.isError ? 1 : 0);
} catch (err) {
  console.error(
    JSON.stringify({
      ok: false,
      name: payload.name,
      error: err instanceof Error ? err.message : String(err),
    }),
  );
  process.exit(1);
} finally {
  await client.close();
}