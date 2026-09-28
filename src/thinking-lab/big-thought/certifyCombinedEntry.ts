import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  certificationExitCode,
  combineCertificationReport,
  deterministicStatusFromExitCode,
  infrastructureCertificationLive,
} from "@/thinking-lab/big-thought/certificationReport";
import { isCertificationInfrastructureError } from "@/thinking-lab/big-thought/certificationTransport";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const vitestEntry = path.join(repoRoot, "node_modules", "vitest", "vitest.mjs");

function runDeterministicSuite(): number | null {
  if (!existsSync(vitestEntry)) return null;
  const result = spawnSync(
    process.execPath,
    [vitestEntry, "run", "src/thinking-lab/big-thought", "--config", "vitest.config.ts", "--reporter=dot"],
    { cwd: repoRoot, stdio: "inherit", env: process.env },
  );
  return result.status;
}

const deterministicStatus = deterministicStatusFromExitCode(runDeterministicSuite());
if (deterministicStatus !== "PASS") {
  const report = combineCertificationReport({ deterministicStatus, live: null });
  console.log(JSON.stringify(report, null, 2));
  process.exit(certificationExitCode(report.overall));
}

if (process.env.THINKING_LAB_LIVE_CERTIFICATION !== "1") {
  console.error(
    "Deterministic Big Thought certification passed. Live semantic certification did not run. Set THINKING_LAB_LIVE_CERTIFICATION=1 to continue. No network call was made.",
  );
  const report = combineCertificationReport({ deterministicStatus: "PASS", live: null });
  console.log(JSON.stringify(report, null, 2));
  process.exit(certificationExitCode(report.overall));
}

try {
  const { runLiveCertification } = await import("./certifyLive.ts");
  const live = await runLiveCertification();
  const report = combineCertificationReport({
    deterministicStatus: "PASS",
    live,
  });
  console.log(JSON.stringify(report, null, 2));
  process.exit(certificationExitCode(report.overall));
} catch (error: unknown) {
  const message = isCertificationInfrastructureError(error)
    ? error.message
    : error instanceof Error
      ? `TRANSPORT_FAILURE case=unknown run=0 stage=unknown http=none scriptMissing=true error=${error.message}`
      : "TRANSPORT_FAILURE case=unknown run=0 stage=unknown http=none scriptMissing=true error=Live certification failed before a verdict.";
  console.error(message);
  const report = combineCertificationReport({
    deterministicStatus: "PASS",
    live: infrastructureCertificationLive([message]),
  });
  console.log(JSON.stringify(report, null, 2));
  process.exit(certificationExitCode(report.overall));
}
