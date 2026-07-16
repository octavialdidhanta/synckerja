import fs from "fs";
import path from "path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const jsonPath = path.join(process.cwd(), "scripts", ".deploy-temp", "lead-magnet-runtime-mcp.json");
const payload = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

function resolveAccessToken() {
  const mcpPath = path.join(process.env.USERPROFILE ?? "", ".cursor", "mcp.json");
  if (fs.existsSync(mcpPath)) {
    const cfg = JSON.parse(fs.readFileSync(mcpPath, "utf8"));
    const token = cfg?.mcpServers?.supabase?.env?.SUPABASE_ACCESS_TOKEN?.trim();
    if (token) return token;
  }
  const fromEnv = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  return "";
}

const accessToken = resolveAccessToken();
if (!accessToken) {
  console.error("ERROR: SUPABASE_ACCESS_TOKEN is required");
  process.exit(1);
}

const transport = new StdioClientTransport({
  command: "npx",
  args: [
    "-y",
    "@supabase/mcp-server-supabase@latest",
    "--access-token",
    accessToken,
    "--project-ref",
    "wqdzqqshoifwyrltzgvx",
  ],
});

const client = new Client({ name: "invoke-mcp-deploy", version: "1.0.0" });

try {
  await client.connect(transport);
  const result = await client.callTool({
    name: "deploy_edge_function",
    arguments: {
      name: payload.name,
      entrypoint_path: payload.entrypoint_path,
      verify_jwt: payload.verify_jwt,
      files: payload.files,
    },
  });
  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  console.error("ERROR:", err instanceof Error ? err.message : String(err));
  process.exit(1);
} finally {
  await client.close();
}
