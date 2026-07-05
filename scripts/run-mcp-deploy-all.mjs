/**
 * Deploy edge functions by reading pre-built MCP invoke JSON and printing
 * instructions. Actual deploy is done via Cursor MCP deploy_edge_function tool.
 *
 * Usage: node scripts/run-mcp-deploy-all.mjs
 */
import fs from "fs";
import path from "path";

const fns = ["flow-runtime-send", "flow-runtime", "whatsapp-webhook"];
for (const fn of fns) {
  const p = path.join(process.cwd(), "scripts", ".deploy-temp", `mcp-invoke-${fn}.json`);
  if (!fs.existsSync(p)) {
    console.error(`Missing ${p}. Run: node scripts/mcp-deploy-one.mjs ${fn}`);
    process.exit(1);
  }
  const bytes = fs.statSync(p).size;
  console.log(`${fn}: ${bytes} bytes ready at ${p}`);
}
