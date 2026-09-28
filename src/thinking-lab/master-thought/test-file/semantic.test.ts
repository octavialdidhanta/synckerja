import { describe, expect, it, vi } from "vitest";
import {
  assessMasterThought,
  buildMasterThoughtJudgePrompt,
  confirmedFingerprint,
  confirmedParentReady,
  judgeMasterThought,
  normalizeMasterThoughtFacts,
  parseMasterThoughtFacts,
  resolveConfirmation,
  understandPersistMode,
} from "@/thinking-lab/master-thought/semantic";
import type { MasterThoughtFacts } from "@/thinking-lab/master-thought/types";

const BANNED = ["tithing", "tithe", "obc", "charity", "apple", "iphone"];
const UMBRELLA = "Ibuku adalah orang paling baik sedunia.";

function readyFacts(overrides: Partial<MasterThoughtFacts> = {}): MasterThoughtFacts {
  return {
    outcome: "ORIGINAL_READY",
    subject: "the parent",
    proposedRootBelief: null,
    formulationNote: null,
    clarificationQuestion: null,
    clarificationOptions: null,
    resolution: "RESOLVED",
    unresolvedReasons: [],
    ...overrides,
  };
}

describe("master thought understand boundary", () => {
  it("keeps an unresolved judgment unresolved even when confidence is high", () => {
    const facts = readyFacts({ confidence: 0.99, resolution: "UNRESOLVED", unresolvedReasons: ["INCOMPLETE"] });
    expect(assessMasterThought(facts, true)).toBe("UNRESOLVED");
  });

  it("accepts a resolved original even when confidence is low", () => {
    expect(assessMasterThought(readyFacts({ confidence: 0.01 }), true)).toBe("USABLE");
  });

  it("does not name a domain or brand in the judge prompt", () => {
    const prompt = buildMasterThoughtJudgePrompt("A general belief.").toLowerCase();
    for (const word of BANNED) expect(prompt).not.toContain(word);
  });

  it("treats ORIGINAL_READY as a preserved parent that still needs confirmation", () => {
    const original = "A broad umbrella belief.";
    const facts = normalizeMasterThoughtFacts(
      { outcome: "ORIGINAL_READY", subject: "the parent", proposedRootBelief: original, resolution: "RESOLVED", unresolvedReasons: [] },
      original,
    );
    expect(facts.outcome).toBe("ORIGINAL_READY");
    expect(facts.proposedRootBelief).toBeNull();
    expect(assessMasterThought(facts, true)).toBe("USABLE");
    expect(
      resolveConfirmation({
        source: "original",
        originalInput: original,
        proposedRootBelief: null,
        facts,
        factsCurrent: true,
      }),
    ).toEqual({ ok: true, statement: original });
    expect(
      resolveConfirmation({
        source: "recommendation",
        originalInput: original,
        proposedRootBelief: null,
        facts,
        factsCurrent: true,
      }).ok,
    ).toBe(false);
    expect(
      confirmedParentReady({
        confirmationSource: null,
        statement: original,
        rootBelief: original,
        semanticFingerprint: confirmedFingerprint(original, original),
      }),
    ).toBe(false);
    expect(
      confirmedParentReady({
        confirmationSource: "original",
        statement: original,
        rootBelief: original,
        semanticFingerprint: confirmedFingerprint(original, original),
      }),
    ).toBe(true);
  });

  it("keeps both texts when a proposal is actually different", () => {
    const original = "The belief, said in a way that tangles two claims.";
    const proposal = "The belief, said as one parent claim.";
    const facts = normalizeMasterThoughtFacts(
      {
        outcome: "PROPOSAL_RECOMMENDED",
        subject: "the belief",
        proposedRootBelief: proposal,
        formulationNote: "The wording joins two claims.",
        resolution: "RESOLVED",
        unresolvedReasons: [],
      },
      original,
    );
    expect(facts.outcome).toBe("PROPOSAL_RECOMMENDED");
    expect(facts.proposedRootBelief).toBe(proposal);
    expect(
      resolveConfirmation({
        source: "original",
        originalInput: original,
        proposedRootBelief: proposal,
        facts,
        factsCurrent: true,
      }),
    ).toEqual({ ok: true, statement: original });
    expect(
      resolveConfirmation({
        source: "recommendation",
        originalInput: original,
        proposedRootBelief: proposal,
        facts,
        factsCurrent: true,
      }),
    ).toEqual({ ok: true, statement: proposal });
  });

  it("blocks a parent proposal while clarification is required", () => {
    const original = "A parent belief with two possible meanings.";
    const question = "Which meaning should this parent belief keep?";
    const answer = "The broader meaning.";
    const facts = normalizeMasterThoughtFacts(
      {
        outcome: "CLARIFICATION_REQUIRED",
        proposedRootBelief: "A narrowed belief",
        clarificationQuestion: question,
        clarificationOptions: ["The broader meaning."],
        resolution: "RESOLVED",
        unresolvedReasons: [],
      },
      original,
    );
    expect(facts.proposedRootBelief).toBeNull();
    expect(facts.clarificationQuestion).toBe(question);
    expect(assessMasterThought(facts, true)).toBe("UNRESOLVED");
    const prompt = buildMasterThoughtJudgePrompt(original, { question, answer });
    expect(prompt).toContain(question);
    expect(prompt).toContain(answer);
    expect(prompt).not.toContain("A narrowed belief");
  });

  it("accepts a broad original when the semantic owner marks it ready", () => {
    const facts = normalizeMasterThoughtFacts(
      {
        outcome: "ORIGINAL_READY",
        subject: "Ibuku",
        proposedRootBelief: null,
        resolution: "RESOLVED",
        unresolvedReasons: [],
      },
      UMBRELLA,
    );
    expect(facts.outcome).toBe("ORIGINAL_READY");
    expect(facts.proposedRootBelief).toBeNull();
    const duplicate = normalizeMasterThoughtFacts(
      {
        outcome: "PROPOSAL_RECOMMENDED",
        subject: "Ibuku",
        proposedRootBelief: UMBRELLA,
        formulationNote: "Same sentence.",
        resolution: "RESOLVED",
        unresolvedReasons: [],
      },
      UMBRELLA,
    );
    expect(duplicate.outcome).toBe("ORIGINAL_READY");
    expect(duplicate.proposedRootBelief).toBeNull();
  });

  it("requires a positive parent belief and refuses to invent one", () => {
    const prompt = buildMasterThoughtJudgePrompt("A general belief.");
    const required = [
      "ORIGINAL_READY is a positive requirement, not the fallback when no other problem is noticed.",
      "contains an actual belief, claim, or proposition",
      "exactly one coherent parent belief",
      "A topic only, a concept only, a question, an instruction, a request, an execution request, or a fragment with no actual claim does not itself contain a parent belief.",
      "Several materially independent beliefs with no single parent root are not one coherent parent belief and are not ORIGINAL_READY.",
      "When no parent belief is present, return UNRESOLVED.",
      "Do not invent a parent belief.",
      "Do not synthesize an umbrella belief.",
      "Do not use PROPOSAL_RECOMMENDED to create a belief the user never stated.",
      "Do not use CLARIFICATION_REQUIRED merely to ask the user to invent a belief.",
      "CLARIFICATION_REQUIRED only when an actual belief is already present",
      "It must not request supporting WHYs.",
      "Broadness alone is not ambiguity.",
      "Subjectivity alone is not ambiguity.",
      "more elegant, more strategic",
      "If the original already works as the parent belief, return ORIGINAL_READY.",
      "A weak or circular supporting WHY does not by itself remove a clear parent belief.",
      "Do not reject a clear parent belief only because its supporting WHY is circular",
      "must later be visible as the cause at Idea",
      "the shortest clause that still states the planted belief",
      "stay grammatical immediately before karena or because",
      "A noun phrase or other span lifted from the middle of the sentence is not a subject.",
    ];
    for (const line of required) expect(prompt).toContain(line);
  });

  it("tells the semantic owner that clarification resolves WHAT and must not request WHY", () => {
    const prompt = buildMasterThoughtJudgePrompt("A general belief.", {
      question: "Which meaning should stay?",
      answer: "karena",
    });
    expect(prompt).toContain("Understand clarifies WHAT the Master Thought means.");
    expect(prompt).toContain("It must not request supporting WHYs.");
    expect(prompt).toContain("User answer:\nkarena");
    const other = buildMasterThoughtJudgePrompt("A general belief.", {
      question: "Which meaning should stay?",
      answer: "other",
    });
    expect(prompt.slice(0, prompt.indexOf("User answer:"))).toBe(other.slice(0, other.indexOf("User answer:")));
  });

  it("does not invalidate a confirmed parent when understand is rerun on the same text", () => {
    const statement = "The confirmed parent.";
    const before = {
      confirmationSource: "original",
      semanticFingerprint: confirmedFingerprint(statement, statement),
      lastAudit: { schema: "thinking-lab/v1", siblingSet: null, audit: { items: [] }, challenger: null },
    };
    const mode = understandPersistMode({
      confirmationSource: before.confirmationSource,
      confirmedStatement: statement,
      storedOriginalInput: statement,
      nextOriginalInput: statement,
    });
    expect(mode).toBe("display_only");
    const after = {
      ...before,
      facts: readyFacts(),
    };
    expect(after.confirmationSource).toBe(before.confirmationSource);
    expect(after.semanticFingerprint).toBe(before.semanticFingerprint);
    expect(after.lastAudit).toEqual(before.lastAudit);
    expect(
      understandPersistMode({
        confirmationSource: "original",
        confirmedStatement: statement,
        storedOriginalInput: statement,
        nextOriginalInput: "A different parent.",
      }),
    ).toBe("replace_understanding");
  });

  it("fails closed when stored facts have no outcome", () => {
    const facts = normalizeMasterThoughtFacts(
      {
        coreBelief: "Old paraphrase",
        proposedRootBelief: "Old paraphrase",
        normalizationNeeded: false,
        resolution: "RESOLVED",
        unresolvedReasons: [],
      },
      "Old paraphrase",
    );
    expect(facts.outcome).toBe("UNRESOLVED");
    expect(assessMasterThought(facts, true)).toBe("UNRESOLVED");
  });

  it("refuses a parent whose subject cannot be named", () => {
    const original = "A broad umbrella belief.";
    const missing = normalizeMasterThoughtFacts(
      { outcome: "ORIGINAL_READY", resolution: "RESOLVED", unresolvedReasons: [] },
      original,
    );
    expect(missing.outcome).toBe("UNRESOLVED");
    expect(missing.unresolvedReasons).toContain("SUBJECT_UNNAMED");
    expect(assessMasterThought(missing, true)).toBe("UNRESOLVED");
    const copied = normalizeMasterThoughtFacts(
      { outcome: "ORIGINAL_READY", subject: original, resolution: "RESOLVED", unresolvedReasons: [] },
      original,
    );
    expect(copied.subject).toBeNull();
    const named = normalizeMasterThoughtFacts(
      { outcome: "ORIGINAL_READY", subject: "the parent", resolution: "RESOLVED", unresolvedReasons: [] },
      original,
    );
    expect(named.subject).toBe("the parent");
    expect(assessMasterThought(named, true)).toBe("USABLE");
  });

  it("asks for a short meaning and refuses a subject copied from the sentence", () => {
    const prompt = buildMasterThoughtJudgePrompt("A general belief.");
    expect(prompt).toContain("the shortest clause that still states the planted belief");
    expect(prompt).toContain("stay grammatical immediately before karena or because");
    expect(prompt).toContain("A shorter prefix of the planted belief is allowed");
    const original = "Daripada menabung, mengejar motor paling kencang dan modif paling epik adalah hal paling penting.";
    const copied = parseMasterThoughtFacts(
      JSON.stringify({
        outcome: "ORIGINAL_READY",
        subject: "Motor paling kencang dan modif paling epik",
        resolution: "RESOLVED",
        unresolvedReasons: [],
      }),
      original,
    );
    expect(copied.outcome).toBe("UNRESOLVED");
    expect(copied.unresolvedReasons).toContain("SUBJECT_IS_FRAGMENT");
    const meaning = parseMasterThoughtFacts(
      JSON.stringify({
        outcome: "ORIGINAL_READY",
        subject: "Prioritas motor keren",
        resolution: "RESOLVED",
        unresolvedReasons: [],
      }),
      original,
    );
    expect(meaning.outcome).toBe("ORIGINAL_READY");
    expect(meaning.subject).toBe("Prioritas motor keren");
    const stored = normalizeMasterThoughtFacts(
      {
        outcome: "ORIGINAL_READY",
        subject: "motor paling kencang dan modif paling epik",
        resolution: "RESOLVED",
        unresolvedReasons: [],
      },
      original,
    );
    expect(stored.subject).toBe("motor paling kencang dan modif paling epik");
    const prefix = parseMasterThoughtFacts(
      JSON.stringify({
        outcome: "ORIGINAL_READY",
        subject: "Uang di usia muda lebih berharga ditabung",
        resolution: "RESOLVED",
        unresolvedReasons: [],
      }),
      "Uang di usia muda lebih berharga ditabung daripada dihabiskan untuk mengejar motor paling kencang.",
    );
    expect(prefix.outcome).toBe("ORIGINAL_READY");
    expect(prefix.subject).toBe("Uang di usia muda lebih berharga ditabung");
  });
});

describe("master thought comparison", () => {
  const planted = "Uang muda lebih berharga ditabung.";
  const prior = "Motor paling kencang adalah hal paling penting.";
  const proposal = "Uang muda lebih berharga ditabung daripada motor paling kencang.";

  it("keeps ORIGINAL_READY when the planted belief already makes the shift", () => {
    const facts = normalizeMasterThoughtFacts(
      {
        outcome: "ORIGINAL_READY",
        subject: "uang muda",
        comparisonForm: "PRESENT",
        resolution: "RESOLVED",
        unresolvedReasons: [],
      },
      planted,
      prior,
    );
    expect(facts.outcome).toBe("ORIGINAL_READY");
    expect(facts.proposedRootBelief).toBeNull();
  });

  it("turns a missing comparison into a proposal that keeps the planted claim", () => {
    const facts = normalizeMasterThoughtFacts(
      {
        outcome: "ORIGINAL_READY",
        subject: "uang muda",
        comparisonForm: "MISSING",
        proposedRootBelief: proposal,
        formulationNote: "The original does not name what it replaces.",
        resolution: "RESOLVED",
        unresolvedReasons: [],
      },
      planted,
      prior,
    );
    expect(facts.outcome).toBe("PROPOSAL_RECOMMENDED");
    expect(facts.proposedRootBelief).toBe(proposal);
  });

  it("fails closed when the comparison is missing and no proposal is offered", () => {
    const facts = normalizeMasterThoughtFacts(
      {
        outcome: "ORIGINAL_READY",
        subject: "uang muda",
        comparisonForm: "MISSING",
        resolution: "RESOLVED",
        unresolvedReasons: [],
      },
      planted,
      prior,
    );
    expect(facts.outcome).toBe("UNRESOLVED");
    expect(facts.unresolvedReasons).toContain("COMPARISON_MISSING");
  });

  it("does not rejudge stored facts that have no comparison field", () => {
    const facts = normalizeMasterThoughtFacts(
      {
        outcome: "ORIGINAL_READY",
        subject: "uang muda",
        resolution: "RESOLVED",
        unresolvedReasons: [],
      },
      planted,
      prior,
    );
    expect(facts.outcome).toBe("ORIGINAL_READY");
    expect(assessMasterThought(facts, true)).toBe("USABLE");
  });

  it("leaves the comparison gate off when no prior belief is stored", () => {
    const facts = normalizeMasterThoughtFacts(
      {
        outcome: "ORIGINAL_READY",
        subject: "uang muda",
        comparisonForm: "MISSING",
        resolution: "RESOLVED",
        unresolvedReasons: [],
      },
      planted,
      "",
    );
    expect(facts.outcome).toBe("ORIGINAL_READY");
    const prompt = buildMasterThoughtJudgePrompt(planted);
    expect(prompt).not.toContain("comparisonForm must be PRESENT");
    expect(prompt).not.toContain("The audience is only the people being addressed.");
  });

  it("rejects a proposal that copies the prior belief or starts with because", () => {
    const copied = normalizeMasterThoughtFacts(
      {
        outcome: "PROPOSAL_RECOMMENDED",
        subject: "uang muda",
        comparisonForm: "MISSING",
        proposedRootBelief: prior,
        formulationNote: "Copied the old belief.",
        resolution: "RESOLVED",
        unresolvedReasons: [],
      },
      planted,
      prior,
    );
    expect(copied.unresolvedReasons).toContain("PROPOSAL_IS_PRIOR");
    const because = normalizeMasterThoughtFacts(
      {
        outcome: "ORIGINAL_READY",
        subject: "uang muda",
        comparisonForm: "MISSING",
        proposedRootBelief: "karena bunga majemuk punya waktu lebih lama.",
        formulationNote: "Added a reason.",
        resolution: "RESOLVED",
        unresolvedReasons: [],
      },
      planted,
      prior,
    );
    expect(because.unresolvedReasons).toContain("PROPOSAL_IS_BECAUSE");
  });

  it("fails closed when the comparison itself is unresolved", () => {
    const facts = normalizeMasterThoughtFacts(
      {
        outcome: "ORIGINAL_READY",
        subject: "uang muda",
        comparisonForm: "UNRESOLVED",
        resolution: "RESOLVED",
        unresolvedReasons: [],
      },
      planted,
      prior,
    );
    expect(facts.unresolvedReasons).toContain("COMPARISON_UNRESOLVED");
  });

  it("names the audience only as context and refuses the same two beliefs before the model", async () => {
    const prompt = buildMasterThoughtJudgePrompt(planted, undefined, {
      priorBelief: prior,
      audience: "remaja laki-laki",
    });
    expect(prompt).toContain("The audience is only the people being addressed.");
    expect(prompt).toContain("Do not change the claim.");
    expect(prompt).toContain("remaja laki-laki");
    expect(prompt).toContain(prior);
    const ask = vi.fn();
    const facts = await judgeMasterThought("Sama.", ask, undefined, { priorBelief: "  Sama. " });
    expect(facts.unresolvedReasons).toContain("SAME_BELIEF");
    expect(ask).not.toHaveBeenCalled();
    expect(
      confirmedParentReady({
        confirmationSource: "original",
        statement: planted,
        rootBelief: planted,
        semanticFingerprint: confirmedFingerprint(planted, planted),
      }),
    ).toBe(true);
  });
});
