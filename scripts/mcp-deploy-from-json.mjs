/**
 * Reads MCP deploy JSON payloads and prints deploy args for each function.
 * Usage: node scripts/mcp-deploy-from-json.mjs flow-runtime-send
 */
import fs from "fs";
import path from "path";

const name = process.argv[2];
if (!name) {
  console.error("Usage: node scripts/mcp-deploy-from-json.mjs <function-name>");
  process.exit(1);
}

const jsonPath = path.join(process.cwd(), "scripts", ".deploy-temp", `mcp-${name}.json`);
if (!fs.existsSync(jsonPath)) {
  console.error(`Missing ${jsonPath}`);
  process.exit(1);
}

const payload = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
process.stdout.write(JSON.stringify({
  name: payload.name,
  entrypoint_path: payload.entrypoint_path,
  verify_jwt: payload.verify_jwt ?? false,
  files: payload.files,
}));
