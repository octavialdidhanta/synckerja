/**
 * Prints deploy_edge_function arguments JSON to stdout for MCP handoff.
 * Usage: node scripts/mcp-deploy-lead-magnet-runtime.mjs [payload.json]
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const payloadPath =
  process.argv[2] ??
  path.join(__dirname, ".deploy-lead-magnet-runtime.json");

const raw = JSON.parse(fs.readFileSync(payloadPath, "utf8"));
const args = {
  name: raw.name,
  entrypoint_path: "lead-magnet-runtime/index.ts",
  verify_jwt: false,
  files: raw.files,
};

if (!Array.isArray(args.files) || args.files.length !== 46) {
  console.error(
    JSON.stringify({
      error: "invalid_files",
      count: Array.isArray(args.files) ? args.files.length : 0,
    }),
  );
  process.exit(1);
}

process.stdout.write(JSON.stringify(args));
