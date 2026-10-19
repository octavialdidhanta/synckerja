import { describe, expect, it, vi } from "vitest";
import {
  buildAnglePassPrompt,
  finishAngleSiblingCheck,
  parseAnglePassCheck,
  runAngleIndividualChecks,
  runAngleOpenChecks,
} from "@/thinking-lab/angle/passChecklist";

const parent = "Pilihan makan siang";

describe("angle pass checklist", () => {
  it("asks each check in the pass order", () => {
    const prompt = buildAnglePassPrompt({
      id: "stakeHolds",
      statement: "Menu kantor terlihat murah karena porsinya kecil",
      parentStatement: parent,
      ancestors: [{ label: "Big Thought", statement: "Penyedia membeli bahan dalam jumlah besar." }],
    });
    expect(prompt).toContain("distinctive stake of this Territory");
    expect(prompt).toContain("Menu kantor terlihat murah karena porsinya kecil");
    expect(prompt).toContain("Big Thought: Penyedia membeli bahan dalam jumlah besar.");
    expect(
      buildAnglePassPrompt({
        id: "severalIdeas",
        statement: "Menu kantor terlihat murah karena porsinya kecil",
        parentStatement: parent,
      }),
    ).toContain("several semantically distinct Ideas");
    expect(
      buildAnglePassPrompt({
        id: "observationJob",
        statement: "Menu kantor terlihat murah karena porsinya kecil",
        parentStatement: parent,
      }),
    ).toContain("because-clause");
  });

  it("treats an undecided answer as a failure", () => {
    expect(parseAnglePassCheck(null)).toEqual({ pass: false, reason: "This check could not be decided." });
    expect(parseAnglePassCheck('{"pass":"maybe"}')).toEqual({
      pass: false,
      reason: "This check could not be decided.",
    });
    expect(parseAnglePassCheck('{"pass":false,"reason":"Ini hanya mengulang wilayahnya."}')).toEqual({
      pass: false,
      reason: "Ini hanya mengulang wilayahnya.",
    });
  });

  it("stops at the first failed check and does not ask the later ones", async () => {
    const ask = vi.fn(async (prompt: string) => {
      if (prompt.includes("distinctive stake")) return '{"pass":true,"reason":""}';
      if (prompt.includes("narrower than the Territory")) return '{"pass":false,"reason":"Ini sudah konsep Idea."}';
      return '{"pass":true,"reason":""}';
    });
    const seen: string[] = [];
    const result = await runAngleIndividualChecks({
      statement: "Kita bikin perbandingan porsi",
      parentStatement: parent,
      ask,
      onStep: (checks) => {
        const current = checks.find((check) => check.state === "running" || check.state === "fail");
        if (current) seen.push(`${current.id}:${current.state}`);
      },
    });
    expect(ask).toHaveBeenCalledTimes(2);
    expect(result.passed).toBe(false);
    expect(result.checks.find((check) => check.id === "stakeHolds")?.state).toBe("pass");
    expect(result.checks.find((check) => check.id === "observationShape")).toMatchObject({
      state: "fail",
      reason: "Ini sudah konsep Idea.",
    });
    expect(result.checks.find((check) => check.id === "severalIdeas")?.state).toBe("pending");
    expect(result.checks.find((check) => check.id === "clearBoundary")?.state).toBe("pending");
    expect(result.checks.find((check) => check.id === "observationJob")?.state).toBe("pending");
    expect(result.checks.find((check) => check.id === "siblingsDistinct")?.state).toBe("pending");
    expect(seen).toContain("observationShape:fail");
    expect(finishAngleSiblingCheck(result.checks, true, "").find((check) => check.id === "siblingsDistinct")?.state).toBe(
      "pending",
    );
  });

  it("re-asks only the failed check when the earlier checks already passed", async () => {
    const ask = vi.fn(async () => '{"pass":true,"reason":""}');
    const result = await runAngleOpenChecks({
      statement: "Keputusan mikro di dapur jarang dihitung sebagai usaha",
      parentStatement: parent,
      prior: [
        { id: "stakeHolds", state: "pass" },
        { id: "observationShape", state: "pass" },
        { id: "severalIdeas", state: "pass" },
        { id: "clearBoundary", state: "pass" },
        { id: "observationJob", state: "fail", reason: "Ini alasan karena." },
        { id: "ownSubject", state: "pass" },
        { id: "livedExample", state: "pass" },
        { id: "siblingsDistinct", state: "pending" },
      ],
      ask,
      onStep: () => undefined,
    });
    expect(ask).toHaveBeenCalledTimes(1);
    expect(ask.mock.calls[0]?.[0]).toContain("because-clause");
    expect(result.passed).toBe(true);
    expect(result.checks.filter((check) => check.id !== "siblingsDistinct").every((check) => check.state === "pass")).toBe(
      true,
    );
  });

  it("fails a missing subject without asking the model", async () => {
    const ask = vi.fn(async () => '{"pass":true,"reason":""}');
    const result = await runAngleOpenChecks({
      statement: "Tugas dapur secara tidak terduga membebani dengan keputusan mikro",
      parentStatement: "Tugas dapur",
      subject: "",
      prior: [
        { id: "stakeHolds", state: "pass" },
        { id: "observationShape", state: "pass" },
        { id: "severalIdeas", state: "pass" },
        { id: "clearBoundary", state: "pass" },
        { id: "observationJob", state: "pass" },
      ],
      ask,
      onStep: () => undefined,
    });
    expect(ask).not.toHaveBeenCalled();
    expect(result.passed).toBe(false);
    expect(result.checks.find((check) => check.id === "ownSubject")).toMatchObject({
      state: "fail",
      reason: "This Angle has no short subject.",
    });
  });

  it("fails a missing example without asking the model", async () => {
    const ask = vi.fn(async () => '{"pass":true,"reason":""}');
    const result = await runAngleOpenChecks({
      statement: "Pembelian berlebih menggeser fokus ke kepemilikan",
      parentStatement: "Pembelian berlebih",
      subject: "Pergeseran fokus kepemilikan",
      example: "",
      prior: [
        { id: "stakeHolds", state: "pass" },
        { id: "observationShape", state: "pass" },
        { id: "severalIdeas", state: "pass" },
        { id: "clearBoundary", state: "pass" },
        { id: "observationJob", state: "pass" },
        { id: "ownSubject", state: "pass" },
      ],
      ask,
      onStep: () => undefined,
    });
    expect(ask).not.toHaveBeenCalled();
    expect(result.checks.find((check) => check.id === "livedExample")).toMatchObject({
      state: "fail",
      reason: "This Angle has no example.",
    });
    expect(
      buildAnglePassPrompt({
        id: "livedExample",
        statement: "Pembelian berlebih menggeser fokus ke kepemilikan",
        parentStatement: "Pembelian berlebih",
        example: "Lemari sudah penuh baju tapi yang terasa kurang selalu baju baru",
      }),
    ).toContain("concrete situation");
  });
});
