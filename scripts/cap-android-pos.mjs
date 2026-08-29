/**
 * Run Capacitor CLI against the POS config (`capacitor.config.pos.ts`) by
 * temporarily swapping root `capacitor.config.ts`, then restoring Office config.
 *
 * Usage: node scripts/cap-android-pos.mjs sync|open|copy|update [...]
 */
import { copyFileSync, existsSync, unlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const officeConfig = path.join(root, "capacitor.config.ts");
const posConfig = path.join(root, "capacitor.config.pos.ts");
const bak = path.join(root, "capacitor.config.ts.__office_bak");

const capArgs = process.argv.slice(2);
if (capArgs.length === 0) {
  console.error("Usage: node scripts/cap-android-pos.mjs <cap-args…>");
  console.error("Example: node scripts/cap-android-pos.mjs sync android");
  process.exit(1);
}

if (!existsSync(posConfig)) {
  console.error("Missing capacitor.config.pos.ts");
  process.exit(1);
}
if (!existsSync(officeConfig)) {
  console.error("Missing capacitor.config.ts");
  process.exit(1);
}

copyFileSync(officeConfig, bak);
copyFileSync(posConfig, officeConfig);

let status = 1;
try {
  const result = spawnSync("npx", ["cap", ...capArgs], {
    cwd: root,
    stdio: "inherit",
    shell: true,
  });
  status = result.status ?? 1;
} finally {
  try {
    copyFileSync(bak, officeConfig);
    unlinkSync(bak);
  } catch (err) {
    console.error("Failed to restore capacitor.config.ts from backup:", err);
    status = 1;
  }
}

process.exit(status);
