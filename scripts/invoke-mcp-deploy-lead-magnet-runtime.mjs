/**
 * Reads deploy payload JSON and prints MCP deploy arguments to stdout (for tooling).
 * Usage: node scripts/invoke-mcp-deploy-lead-magnet-runtime.mjs
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

process.stdout.write(JSON.stringify(args));
