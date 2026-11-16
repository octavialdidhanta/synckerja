/**
 * deploy_edge_function via local Supabase MCP (same tool as plugin-supabase-supabase).
 * Payload shape matches deploy_edge_function schema.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const payloadPath = process.argv[2];
if (!payloadPath) {
  console.error("Usage: node scripts/deploy-edge-json-via-mcp.mjs <payload.json>");
  process.exit(1);
}

const payload = JSON.parse(fs.readFileSync(path.resolve(payloadPath), "utf8"));
const mcpPath = path.join(process.env.USERPROFILE ?? "", ".cursor", "mcp.json");
const cfg = JSON.parse(fs.readFileSync(mcpPath, "utf8"));
const server = cfg?.mcpServers?.supabase;

if (!server?.command) {
  console.error(JSON.stringify({ ok: false, error: "supabase MCP server not configured" }));
  process.exit(1);
}

const transport = new StdioClientTransport({
  command: server.command,
  args: server.args ?? [],
  env: { ...process.env, ...(server.env ?? {}) },
});

const client = new Client({ name: "deploy-edge-json-via-mcp", version: "1.0.0" });

try {
  await client.connect(transport);
  const result = await client.callTool({
    name: "deploy_edge_function",
    arguments: {
      name: payload.name,
      entrypoint_path: payload.entrypoint_path,
      verify_jwt: payload.verify_jwt ?? false,
      files: payload.files,
    },
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
      name: payload.name,
      version: parsed?.version ?? null,
      status: parsed?.status ?? null,
      verify_jwt: payload.verify_jwt ?? false,
      error: result.isError ? parsed ?? result : undefined,
    }),
  );
  process.exit(result.isError ? 1 : 0);
} catch (err) {
  console.error(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }));
  process.exit(1);
} finally {
  await client.close();
}