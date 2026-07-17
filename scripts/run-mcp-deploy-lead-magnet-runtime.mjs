/**
 * Invoke user-supabase MCP deploy_edge_function for lead-magnet-runtime.
 * Reads prebuilt args from scripts/.mcp-deploy-args.json (or path arg).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const argsPath =
  process.argv[2] ?? path.join(__dirname, ".mcp-deploy-args.json");

const payload = JSON.parse(fs.readFileSync(argsPath, "utf8"));
const mcpPath = path.join(process.env.USERPROFILE ?? "", ".cursor", "mcp.json");
const cfg = JSON.parse(fs.readFileSync(mcpPath, "utf8"));
const server = cfg?.mcpServers?.["user-supabase"] ?? cfg?.mcpServers?.supabase;

if (!server?.command) {
  console.error(JSON.stringify({ error: "user-supabase MCP server not configured" }));
  process.exit(1);
}

const transport = new StdioClientTransport({
  command: server.command,
  args: server.args ?? [],
  env: { ...process.env, ...(server.env ?? {}) },
});

const client = new Client({ name: "run-mcp-deploy-lead-magnet-runtime", version: "1.0.0" });

try {
  await client.connect(transport);
  const result = await client.callTool({
    name: "deploy_edge_function",
    arguments: {
      name: payload.name,
      entrypoint_path: payload.entrypoint_path ?? "lead-magnet-runtime/index.ts",
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
      isError: result.isError ?? false,
      version: parsed?.version ?? null,
      status: parsed?.status ?? null,
      slug: parsed?.slug ?? payload.name,
      id: parsed?.id ?? null,
      fileCount: payload.files?.length ?? 0,
      result: parsed ?? result,
    }),
  );
  process.exit(result.isError ? 1 : 0);
} catch (err) {
  console.error(
    JSON.stringify({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }),
  );
  process.exit(1);
} finally {
  await client.close();
}
