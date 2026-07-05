import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

const fn = process.argv[2];
if (!fn) {
  console.error("Usage: node scripts/mcp-deploy-one.mjs <function-name>");
  process.exit(1);
}

const argsPath = path.join(process.cwd(), "scripts", ".deploy-temp", `deploy-${fn}-args.json`);
if (!fs.existsSync(argsPath)) {
  console.error(`Missing ${argsPath}. Run: node scripts/regenerate-mcp-deploy.mjs`);
  process.exit(1);
}

const args = JSON.parse(fs.readFileSync(argsPath, "utf8"));
const payload = JSON.stringify(args);

// Write payload for MCP tool invocation
const outPath = path.join(process.cwd(), "scripts", ".deploy-temp", `mcp-invoke-${fn}.json`);
fs.writeFileSync(outPath, payload);
console.log(`Wrote ${outPath} (${payload.length} bytes)`);
console.log(JSON.stringify({ name: args.name, entrypoint_path: args.entrypoint_path, verify_jwt: args.verify_jwt, fileCount: args.files.length }));
