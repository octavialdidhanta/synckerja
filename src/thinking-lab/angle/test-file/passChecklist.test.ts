import { describe, expect, it, vi } from "vitest";
import {
  ANGLE_PASS_CHECK_IDS,
  angleChecksFromStored,
  buildAngleBatchPrompt,
  buildAnglePassPrompt,
  firstAngleFailure,
  parseAnglePassCheck,
  readAngleCheckId,
  runAngleChecks,
} from "@/thinking-lab/angle/passChecklist";
import { parseCheckSettings } from "@/thinking-lab/shared/checkSettings";

const parent = "Pilihan makan siang";
const statement = "Menu kantor terlihat murah karena porsinya kecil";
const subject = "Porsi kecil yang terasa murah";
const example = "Karyawan pesan dua bungkus nasi kantor karena satu porsi tidak cukup.";

/** Answers a batched prompt with one verdict per listed id, and a single check with pass unless listed in fail. */
function model(fail: Record<string, string> = {}) {
  const prompts: string[] = [];
  const ask = vi.fn(async (prompt: string) => {
    prompts.push(prompt);
    const listed = /check id: ([^\n]+)\./.exec(prompt);
    if (listed) {
      const ids = listed[1].split(", ");
      return JSON.stringify({ checks: ids.map((id) => ({ id, pass: !fail[id], reason: fail[id] ?? "" })) });
    }
    const single = Object.keys(fail).find((id) => prompt.startsWith("Decide one Angle pass check") && prompt.includes(`"${id}"`));
    return single ? JSON.stringify({ pass: false, reason: fail[single] }) : '{"pass":true,"reason":""}';
  });
  return { ask, prompts };
}

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
        peers: [{ code: "AN01", statement: "Antrean panjang dianggap tanda enak" }],
      });
    expect(prompt("stakeHolds")).toContain("distinctive stake of this Territory");
    expect(prompt("stakeHolds")).toContain("Big Thought: Penyedia membeli bahan dalam jumlah besar.");
    expect(prompt("observation")).toContain("rarely noticed, a contradiction, or a tension");
    expect(prompt("rightSize")).toContain("several semantically distinct Ideas");
    expect(prompt("ownSubject")).toContain(`Subject: ${subject}`);
    expect(prompt("livedExample")).toContain(`Example: ${example}`);
    expect(prompt("siblingsDistinct")).toContain("different observation from every other Angle");
    expect(prompt("siblingsDistinct")).toContain("AN01: Antrean panjang dianggap tanda enak");
    expect(prompt("observation")).not.toContain("AN01:");
  });

  it("lists every asked check id in the batch prompt", () => {
    const prompt = buildAngleBatchPrompt({ statement, parentStatement: parent, ids: ["stakeHolds", "rightSize"] });
    expect(prompt).toContain("exactly one entry for each check id: stakeHolds, rightSize.");
  });

  it("reads the eight earlier check ids as the six", () => {
    expect(readAngleCheckId("observationShape")).toBe("observation");
    expect(readAngleCheckId("observationJob")).toBe("observation");
    expect(readAngleCheckId("clearBoundary")).toBe("rightSize");
    expect(readAngleCheckId("severalIdeas")).toBe("rightSize");
    expect(readAngleCheckId("ownSubject")).toBe("ownSubject");
    expect(readAngleCheckId("nope")).toBeNull();
  });

  it("turns a new check ON when any switch it replaced was ON", () => {
    expect(parseCheckSettings({ "angle.observationJob": true, "angle.severalIdeas": true })).toEqual({
      "angle.observation": true,
      "angle.rightSize": true,
    });
    expect(parseCheckSettings({ "angle.observationShape": false })).toEqual({});
  });

  it("shows a stored result, also one saved under an old id", () => {
    const checks = angleChecksFromStored({ gateFailure: { gate: "clearBoundary", reason: "Terlalu luas." } });
    expect(checks.find((check) => check.id === "stakeHolds")?.state).toBe("pass");
    expect(checks.find((check) => check.id === "observation")?.state).toBe("pass");
    expect(checks.find((check) => check.id === "rightSize")).toMatchObject({ state: "fail", reason: "Terlalu luas." });
    expect(checks.find((check) => check.id === "ownSubject")?.state).toBe("pending");
    expect(angleChecksFromStored({ passed: true }).every((check) => check.state === "pass")).toBe(true);
    expect(angleChecksFromStored({})).toEqual([]);
  });

  it("treats an undecided answer as a failure", () => {
    expect(parseAnglePassCheck(null)).toEqual({ pass: false, reason: "This check could not be decided." });
    expect(parseAnglePassCheck('{"pass":"maybe"}')).toEqual({ pass: false, reason: "This check could not be decided." });
    expect(parseAnglePassCheck('{"pass":false,"reason":"Ini hanya mengulang wilayahnya."}')).toEqual({
      pass: false,
      reason: "Ini hanya mengulang wilayahnya.",
    });
  });

  it("asks every open check in one call and stops at the first failure", async () => {
    const { ask } = model({ rightSize: "Sudah satu Idea." });
    const seen: string[] = [];
    const result = await runAngleChecks({
      statement,
      parentStatement: parent,
      subject,
      example,
      ask,
      onStep: (checks) => {
        const current = checks.find((check) => check.state === "fail");
        if (current) seen.push(`${current.id}:${current.state}`);
      },
    });
    expect(ask).toHaveBeenCalledTimes(1);
    expect(result.passed).toBe(false);
    expect(result.checks.find((check) => check.id === "rightSize")).toMatchObject({ state: "fail", reason: "Sudah satu Idea." });
    expect(result.checks.find((check) => check.id === "ownSubject")?.state).toBe("pending");
    expect(firstAngleFailure(result.checks)).toEqual({ gate: "rightSize", reason: "Sudah satu Idea." });
    expect(seen).toContain("rightSize:fail");
  });

  it("does not ask a check switched OFF or kept from an earlier pass", async () => {
    const { ask, prompts } = model();
    const result = await runAngleChecks({
      statement,
      parentStatement: parent,
      subject,
      example,
      skip: ["stakeHolds"],
      keep: ["observation"],
      ask,
    });
    expect(result.passed).toBe(true);
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toContain("check id: rightSize, ownSubject, livedExample.");
  });

  it("fails an empty subject without asking the checks after it", async () => {
    const { ask, prompts } = model();
    const result = await runAngleChecks({ statement, parentStatement: parent, subject: "", example, ask });
    expect(result.checks.find((check) => check.id === "ownSubject")?.state).toBe("fail");
    expect(result.checks.find((check) => check.id === "livedExample")?.state).toBe("pending");
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toContain("check id: stakeHolds, observation, rightSize.");
  });

  it("passes the sibling check with no other Angle, and fails a repeat of one without asking", async () => {
    const first = model();
    const alone = await runAngleChecks({ statement, parentStatement: parent, subject, example, ask: first.ask });
    expect(alone.passed).toBe(true);
    expect(first.prompts.some((prompt) => prompt.includes("siblingsDistinct"))).toBe(false);

    const second = model();
    const repeat = await runAngleChecks({
      statement,
      parentStatement: parent,
      subject,
      example,
      peers: [{ code: "AN01", statement }],
      ask: second.ask,
    });
    expect(repeat.checks.find((check) => check.id === "siblingsDistinct")).toMatchObject({ state: "fail" });
    expect(second.prompts.some((prompt) => prompt.includes("siblingsDistinct"))).toBe(false);
  });

  it("asks the sibling check with the other Angles listed", async () => {
    const { ask, prompts } = model({ siblingsDistinct: "Sama dengan AN01." });
    const result = await runAngleChecks({
      statement,
      parentStatement: parent,
      subject,
      example,
      peers: [{ code: "AN01", statement: "Harga murah membuat orang ragu soal rasa" }],
      ask,
    });
    expect(result.checks.find((check) => check.id === "siblingsDistinct")).toMatchObject({ state: "fail", reason: "Sama dengan AN01." });
    expect(prompts[0]).toContain("AN01: Harga murah membuat orang ragu soal rasa");
  });
});
