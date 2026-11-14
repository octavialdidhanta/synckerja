import { describe, expect, it, vi } from "vitest";
import {
  ANGLE_PASS_CHECK_IDS,
  angleChecksFromStored,
  buildAnglePassPrompt,
  finishAngleSiblingCheck,
  fixPriorForNextAngleStatement,
  parseAnglePassCheck,
  readAngleCheckId,
  readAngleGeneratePasses,
  runAngleAdmissionChecks,
  runAngleIndividualChecks,
  runAngleOpenChecks,
} from "@/thinking-lab/angle/passChecklist";
import { parseCheckSettings } from "@/thinking-lab/shared/checkSettings";

/** vi.fn() mocks declared without params record calls as `[]`; read them with the real arg types. */
const callsOf = <T extends unknown[]>(fn: { mock: { calls: unknown[] } }) => fn.mock.calls as unknown as T[];

const parent = "Pilihan makan siang";
const statement = "Menu kantor terlihat murah karena porsinya kecil";
const subject = "Porsi kecil yang terasa murah";
const example = "Karyawan pesan dua bungkus nasi kantor karena satu porsi tidak cukup.";
const pass = '{"pass":true,"reason":""}';

describe("angle pass checklist", () => {
  it("has six checks in the order they run", () => {
    expect([...ANGLE_PASS_CHECK_IDS]).toEqual(["stakeHolds", "observation", "rightSize", "ownSubject", "livedExample", "siblingsDistinct"]);
  });

  it("writes each rule into its prompt", () => {
    const prompt = (id: Parameters<typeof buildAnglePassPrompt>[0]["id"]) =>
      buildAnglePassPrompt({
        id,
        statement,
        parentStatement: parent,
        ancestors: [{ label: "Big Thought", statement: "Penyedia membeli bahan dalam jumlah besar." }],
        subject,
        example,
      });
    expect(prompt("stakeHolds")).toContain("distinctive stake of this Territory");
    expect(prompt("stakeHolds")).toContain("Big Thought: Penyedia membeli bahan dalam jumlah besar.");
    expect(prompt("observation")).toContain("rarely noticed, a contradiction, or a tension");
    expect(prompt("observation")).toContain("because-reason");
    expect(prompt("rightSize")).toContain("narrower than the Territory");
    expect(prompt("rightSize")).toContain("several semantically distinct Ideas");
    expect(prompt("ownSubject")).toContain(`Subject: ${subject}`);
    expect(prompt("livedExample")).toContain(`Example: ${example}`);
  });

  it("reads the eight earlier check ids as the six", () => {
    expect(readAngleCheckId("observationShape")).toBe("observation");
    expect(readAngleCheckId("observationJob")).toBe("observation");
    expect(readAngleCheckId("clearBoundary")).toBe("rightSize");
    expect(readAngleCheckId("severalIdeas")).toBe("rightSize");
    expect(readAngleCheckId("ownSubject")).toBe("ownSubject");
    expect(readAngleCheckId("nope")).toBeNull();
    expect(readAngleGeneratePasses(["observationJob", "observationShape"])).toEqual(["observation"]);
    expect(readAngleGeneratePasses(["observationJob"])).toEqual([]);
    expect(readAngleGeneratePasses(["observation"])).toEqual(["observation"]);
  });

  it("turns a new check ON when any switch it replaced was ON", () => {
    expect(parseCheckSettings({ "angle.observationJob": true, "angle.severalIdeas": true })).toEqual({
      "angle.observation": true,
      "angle.rightSize": true,
    });
    expect(parseCheckSettings({ "angle.observationShape": false })).toEqual({});
  });

  it("shows a stored result saved under an old id on the check that replaced it", () => {
    const checks = angleChecksFromStored({
      generatePasses: ["observationJob", "observationShape"],
      gateFailure: { gate: "clearBoundary", reason: "Terlalu luas." },
    });
    expect(checks.find((check) => check.id === "stakeHolds")?.state).toBe("pass");
    expect(checks.find((check) => check.id === "observation")?.state).toBe("pass");
    expect(checks.find((check) => check.id === "rightSize")).toMatchObject({ state: "fail", reason: "Terlalu luas." });
    expect(checks.find((check) => check.id === "ownSubject")?.state).toBe("pending");
    expect(angleChecksFromStored({ passed: true }).every((check) => check.state === "pass")).toBe(true);
  });

  it("treats an undecided answer as a failure", () => {
    expect(parseAnglePassCheck(null)).toEqual({ pass: false, reason: "This check could not be decided." });
    expect(parseAnglePassCheck('{"pass":"maybe"}')).toEqual({ pass: false, reason: "This check could not be decided." });
    expect(parseAnglePassCheck('{"pass":false,"reason":"Ini hanya mengulang wilayahnya."}')).toEqual({
      pass: false,
      reason: "Ini hanya mengulang wilayahnya.",
    });
  });

  it("Generate asks only the observation check, and asks again once when undecided", async () => {
    const ask = vi.fn().mockResolvedValueOnce("not json").mockResolvedValueOnce(pass);
    const result = await runAngleAdmissionChecks({ statement, parentStatement: parent, ask, onStep: () => undefined });
    expect(result).toEqual({ checks: [{ id: "observation", state: "pass" }], passed: true });
    expect(ask).toHaveBeenCalledTimes(2);
    expect(callsOf<[string]>(ask)[0]?.[0]).toContain("rarely noticed");
  });

  it("stops at the first failed check and does not ask the later ones", async () => {
    const ask = vi.fn(async (prompt: string) =>
      prompt.includes("narrower than the Territory") ? '{"pass":false,"reason":"Sudah satu Idea."}' : pass,
    );
    const seen: string[] = [];
    const result = await runAngleIndividualChecks({
      statement,
      parentStatement: parent,
      subject,
      example,
      ask,
      onStep: (checks) => {
        const current = checks.find((check) => check.state === "running" || check.state === "fail");
        if (current) seen.push(`${current.id}:${current.state}`);
      },
    });
    expect(ask).toHaveBeenCalledTimes(3);
    expect(result.passed).toBe(false);
    expect(result.checks.find((check) => check.id === "rightSize")).toMatchObject({ state: "fail", reason: "Sudah satu Idea." });
    expect(result.checks.find((check) => check.id === "ownSubject")?.state).toBe("pending");
    expect(seen).toContain("rightSize:fail");
    expect(finishAngleSiblingCheck(result.checks, true, "").find((check) => check.id === "siblingsDistinct")?.state).toBe("pending");
  });

  it("does not ask the carried Generate pass again, nor a check switched OFF", async () => {
    const ask = vi.fn(async () => pass);
    const result = await runAngleIndividualChecks({
      statement,
      parentStatement: parent,
      subject,
      example,
      carried: ["observation"],
      skip: ["stakeHolds"],
      ask,
      onStep: () => undefined,
    });
    expect(result.passed).toBe(true);
    const prompts = callsOf<[string]>(ask).map(([prompt]) => prompt);
    expect(prompts.some((prompt) => prompt.includes("rarely noticed"))).toBe(false);
    expect(prompts.some((prompt) => prompt.includes("distinctive stake"))).toBe(false);
    expect(prompts).toHaveLength(3);
  });

  it("re-asks only the failed check when the others already passed", async () => {
    const ask = vi.fn(async () => pass);
    const result = await runAngleOpenChecks({
      statement,
      parentStatement: parent,
      subject,
      example,
      prior: [
        { id: "stakeHolds", state: "pass" },
        { id: "observation", state: "fail", reason: "Ini alasan karena." },
        { id: "rightSize", state: "pass" },
        { id: "ownSubject", state: "pass" },
        { id: "livedExample", state: "pass" },
      ],
      ask,
      onStep: () => undefined,
    });
    expect(ask).toHaveBeenCalledTimes(1);
    expect(callsOf<[string]>(ask)[0]?.[0]).toContain("rarely noticed");
    expect(result.passed).toBe(true);
  });

  it("fails an empty subject without asking the model", async () => {
    const ask = vi.fn(async () => pass);
    const result = await runAngleOpenChecks({
      statement,
      parentStatement: parent,
      subject: "",
      example,
      prior: [
        { id: "stakeHolds", state: "pass" },
        { id: "observation", state: "pass" },
        { id: "rightSize", state: "pass" },
      ],
      ask,
      onStep: () => undefined,
    });
    expect(ask).not.toHaveBeenCalled();
    expect(result.checks.find((check) => check.id === "ownSubject")?.state).toBe("fail");
  });

  it("a new sentence loses the Generate pass only", () => {
    const prior = [
      { id: "observation" as const, state: "pass" as const },
      { id: "stakeHolds" as const, state: "pass" as const },
    ];
    expect(fixPriorForNextAngleStatement(prior, "a", "b")).toEqual([
      { id: "observation", state: "pending" },
      { id: "stakeHolds", state: "pass" },
    ]);
    expect(fixPriorForNextAngleStatement(prior, "a", "A")).toEqual(prior);
  });
});
