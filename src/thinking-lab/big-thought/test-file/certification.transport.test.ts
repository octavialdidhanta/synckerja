import { describe, expect, it } from "vitest";
import { combineCertificationReport, infrastructureCertificationLive } from "@/thinking-lab/big-thought/certificationReport";
import {
  assessCertificationAttempt,
  CertificationInfrastructureError,
  certificationStageFromPrompt,
  requestCertificationScript,
  type CertificationTransportContext,
} from "@/thinking-lab/big-thought/certificationTransport";
import { buildBigThoughtBatchPrompt, runBigThoughtIndividualChecks } from "@/thinking-lab/big-thought/passChecks";
import { buildSiblingSetPrompt } from "@/thinking-lab/big-thought/semantic";

const context: CertificationTransportContext = {
  caseId: "weak-consistency",
  runNumber: 2,
  stage: "INDIVIDUAL",
};

/** A model answer that could not decide the first check. */
const unresolvedScript = JSON.stringify({ pass: false, reason: "This check could not be decided." });

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("certification transport", () => {
  it("keeps an HTTP failure out of semantic UNRESOLVED", async () => {
    const assessment = assessCertificationAttempt({
      httpStatus: 503,
      body: { error: "upstream unavailable" },
      jsonParsed: true,
      context,
    });
    expect(assessment.outcome).toBe("retry");
    if (assessment.outcome === "script") return;
    expect(assessment.failure).toBeInstanceOf(CertificationInfrastructureError);
    expect(assessment.failure.kind).toBe("TRANSPORT_FAILURE");
    expect(assessment.failure.httpStatus).toBe(503);
    expect(assessment.failure.scriptMissing).toBe(true);
    expect(assessment.failure.responseError).toBe("upstream unavailable");
    expect(assessment.failure.caseId).toBe("weak-consistency");
    expect(assessment.failure.runNumber).toBe(2);
    expect(assessment.failure.stage).toBe("INDIVIDUAL");
    await expect(
      runBigThoughtIndividualChecks({
        statement: "A candidate claim.",
        parentStatement: "A parent claim.",
        others: [],
        ask: async () => {
          throw assessment.failure;
        },
      }),
    ).rejects.toBeInstanceOf(CertificationInfrastructureError);
  });

  it("keeps a missing or malformed script out of semantic UNRESOLVED", () => {
    const missing = assessCertificationAttempt({ httpStatus: 200, body: {}, jsonParsed: true, context });
    const malformed = assessCertificationAttempt({ httpStatus: 200, body: null, jsonParsed: false, context: { ...context, stage: "SIBLING" } });
    expect(missing.outcome).toBe("fail");
    expect(malformed.outcome).toBe("fail");
    if (missing.outcome === "script" || malformed.outcome === "script") return;
    expect(missing.failure.kind).toBe("MALFORMED_RESPONSE");
    expect(missing.failure.scriptMissing).toBe(true);
    expect(malformed.failure.kind).toBe("MALFORMED_RESPONSE");
    expect(malformed.failure.stage).toBe("SIBLING");
    expect(missing.failure.message).not.toContain("UNRESOLVED");
  });

  it("leaves a real model UNRESOLVED script on the semantic path", async () => {
    const assessment = assessCertificationAttempt({
      httpStatus: 200,
      body: { script: unresolvedScript },
      jsonParsed: true,
      context,
    });
    expect(assessment.outcome).toBe("script");
    if (assessment.outcome !== "script") return;
    const script = assessment.script;
    const checklist = await runBigThoughtIndividualChecks({
      statement: "A candidate claim.",
      parentStatement: "A parent claim.",
      others: [],
      ask: async () => script,
    });
    expect(checklist.passed).toBe(false);
    expect(checklist.failure).toMatchObject({ gate: "resolved", reason: "This check could not be decided." });
  });

  it("prevents certification when infrastructure failed", () => {
    const report = combineCertificationReport({
      deterministicStatus: "PASS",
      live: infrastructureCertificationLive([
        "TRANSPORT_FAILURE case=weak-consistency run=2 stage=INDIVIDUAL http=503 scriptMissing=true error=upstream unavailable",
      ]),
    });
    expect(report.liveSemanticStatus).toBe("FAIL");
    expect(report.overall).toBe("NOT_CERTIFIED");
    expect(report.criticalFailures).toEqual([]);
    expect(report.acceptableAmbiguities).toEqual([]);
    expect(report.falseNegatives).toEqual([]);
    expect(report.repeatabilityFailures).toEqual([]);
    expect(report.siblingFailures).toEqual([]);
    expect(report.infrastructureFailures).toHaveLength(1);
  });

  it("retries only transient HTTP statuses and still returns a later usable script", async () => {
    const statuses = [503, 200];
    let fetches = 0;
    const sleeps: number[] = [];
    const script = await requestCertificationScript({
      prompt: "prompt",
      context,
      token: "token",
      url: "https://example.test/certify",
      anonKey: "anon",
      body: { prompt: "prompt" },
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      fetchImpl: async () => {
        fetches += 1;
        const status = statuses[fetches - 1] ?? 503;
        return jsonResponse(status, status === 200 ? { script: unresolvedScript } : { error: "busy" });
      },
    });
    expect(fetches).toBe(2);
    expect(sleeps).toEqual([500]);
    expect(script).toBe(unresolvedScript);
    let providerFetches = 0;
    await expect(
      requestCertificationScript({
        prompt: "prompt",
        context,
        token: "token",
        url: "https://example.test/certify",
        anonKey: "anon",
        body: {},
        sleep: async () => undefined,
        fetchImpl: async () => {
          providerFetches += 1;
          return jsonResponse(400, { error: "bad request" });
        },
      }),
    ).rejects.toMatchObject({ kind: "PROVIDER_FAILURE", httpStatus: 400 });
    expect(providerFetches).toBe(1);
  });

  it("reads the check stage from the production prompt", () => {
    expect(
      certificationStageFromPrompt(
        buildBigThoughtBatchPrompt({
          ids: ["resolved", "relation"],
          statement: "Candidate",
          parentStatement: "Parent",
          others: [],
        }),
      ),
    ).toBe("INDIVIDUAL");
    expect(
      certificationStageFromPrompt(
        buildSiblingSetPrompt({ parentStatement: "Parent", rows: [{ code: "BT01", statement: "One" }] }),
      ),
    ).toBe("SIBLING");
  });
});
