import { describe, expect, it } from "vitest";
import { combineCertificationReport, infrastructureCertificationLive } from "@/thinking-lab/big-thought/certificationReport";
import {
  assessCertificationAttempt,
  CertificationInfrastructureError,
  certificationStageFromPrompt,
  requestCertificationScript,
  type CertificationTransportContext,
} from "@/thinking-lab/big-thought/certificationTransport";
import { individualAdmission } from "@/thinking-lab/big-thought/policy";
import { buildBigThoughtJudgePrompt, buildSiblingSetPrompt, judgeBigThought, parseBigThoughtJudge } from "@/thinking-lab/big-thought/semantic";

const context: CertificationTransportContext = {
  caseId: "weak-consistency",
  runNumber: 2,
  stage: "INDIVIDUAL_FIRST_PASS",
};

const unresolvedScript = JSON.stringify({
  code: "NEW",
  whatItSays: "The dominant reasoning job is unclear",
  relationToParent: "UNRESOLVED",
  supportRole: "UNRESOLVED",
  explainsWhyParentIsTrue: "unresolved",
  introducesUnsupportedPremise: "unresolved",
  duplicateOfCode: null,
  resolution: "UNRESOLVED",
  unresolvedReasons: ["DOMINANT_JOB"],
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("certification transport", () => {
  it("keeps an HTTP failure out of semantic UNRESOLVED", async () => {
    const unavailable = individualAdmission({
      facts: parseBigThoughtJudge(null, "NEW"),
      factsCurrent: true,
    });
    expect(unavailable).toBe("UNRESOLVED");
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
    expect(assessment.failure.stage).toBe("INDIVIDUAL_FIRST_PASS");
    await expect(
      judgeBigThought(
        { parentStatement: "A parent claim.", candidate: { code: "NEW", statement: "A candidate claim." }, siblings: [] },
        async () => {
          throw assessment.failure;
        },
      ),
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
    const facts = parseBigThoughtJudge(assessment.script, "NEW");
    expect(facts.unresolvedReasons).toContain("DOMINANT_JOB");
    expect(facts.unresolvedReasons).not.toContain("JUDGE_UNAVAILABLE");
    expect(individualAdmission({ facts, factsCurrent: true })).toBe("UNRESOLVED");
    let calls = 0;
    const judged = await judgeBigThought(
      { parentStatement: "A parent claim.", candidate: { code: "NEW", statement: "A candidate claim." }, siblings: [] },
      async () => {
        calls += 1;
        return assessment.script;
      },
    );
    expect(calls).toBe(1);
    expect(individualAdmission({ facts: judged, factsCurrent: true })).toBe("UNRESOLVED");
  });

  it("prevents certification when infrastructure failed", () => {
    const report = combineCertificationReport({
      deterministicStatus: "PASS",
      live: infrastructureCertificationLive([
        "TRANSPORT_FAILURE case=weak-consistency run=2 stage=INDIVIDUAL_ADVERSARIAL http=503 scriptMissing=true error=upstream unavailable",
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

  it("reads the judge stage from the production prompt", () => {
    expect(
      certificationStageFromPrompt(
        buildBigThoughtJudgePrompt({
          parentStatement: "Parent",
          candidate: { code: "NEW", statement: "Candidate" },
          siblings: [],
        }),
      ),
    ).toBe("INDIVIDUAL_FIRST_PASS");
    expect(certificationStageFromPrompt("You are the adversarial verifier for one Big Thought classification.")).toBe(
      "INDIVIDUAL_ADVERSARIAL",
    );
    expect(
      certificationStageFromPrompt(
        buildSiblingSetPrompt({ parentStatement: "Parent", rows: [{ code: "BT01", statement: "One" }] }),
      ),
    ).toBe("SIBLING");
  });
});
