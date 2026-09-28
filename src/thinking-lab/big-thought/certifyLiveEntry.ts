import { certificationExitCode, combineCertificationReport, infrastructureCertificationLive } from "@/thinking-lab/big-thought/certificationReport";
import { isCertificationInfrastructureError } from "@/thinking-lab/big-thought/certificationTransport";

if (process.env.THINKING_LAB_LIVE_CERTIFICATION !== "1") {
  console.error(
    "Live semantic certification did not run. Set THINKING_LAB_LIVE_CERTIFICATION=1 to call the production judge. Default npm test stays offline.",
  );
  process.exit(1);
}

const { runLiveCertification } = await import("./certifyLive.ts");

try {
  const report = await runLiveCertification();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.liveSemanticStatus === "PASS" ? 0 : 1);
} catch (error: unknown) {
  const message = isCertificationInfrastructureError(error)
    ? error.message
    : error instanceof Error
      ? `TRANSPORT_FAILURE case=unknown run=0 stage=unknown http=none scriptMissing=true error=${error.message}`
      : "TRANSPORT_FAILURE case=unknown run=0 stage=unknown http=none scriptMissing=true error=Live certification failed before a verdict.";
  console.error(message);
  const report = combineCertificationReport({
    deterministicStatus: "NOT_RUN",
    live: infrastructureCertificationLive([message]),
  });
  console.log(JSON.stringify(report, null, 2));
  process.exit(certificationExitCode(report.overall));
}
