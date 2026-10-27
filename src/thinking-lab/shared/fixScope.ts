export type FixRepair = {
  id: string;
  reason?: string;
};

export type FixScope = {
  preserve: string[];
  repair: FixRepair[];
};

const FIX_ATTEMPT_CAP = 3;

export function fixAttemptCap(): number {
  return FIX_ATTEMPT_CAP;
}

export function fixScopeFromChecks(
  checks: ReadonlyArray<{ id: string; state: string; reason?: string }>,
): FixScope {
  return {
    preserve: checks.filter((check) => check.state === "pass").map((check) => check.id),
    repair: checks
      .filter((check) => check.state === "fail")
      .map((check) => ({ id: check.id, reason: check.reason?.trim() || undefined })),
  };
}

/** Keep every check that already passed, and point the next attempt at the checks that just failed. */
export function nextFixScope(
  previous: FixScope,
  checks: ReadonlyArray<{ id: string; state: string; reason?: string }>,
): FixScope {
  const latest = fixScopeFromChecks(checks);
  return {
    preserve: [...new Set([...previous.preserve, ...latest.preserve])],
    repair: latest.repair.length > 0 ? latest.repair : previous.repair,
  };
}

const CHECK_REASON = /^([a-z][A-Za-z0-9]*):\s*([\s\S]+)$/;

/** When the checklist was cleared, rebuild the failed checks from every stored reason. */
export function scopeFromHistory(
  checks: ReadonlyArray<{ id: string; state: string; reason?: string }>,
  lessons: ReadonlyArray<{ reason: string }>,
): FixScope {
  const live = fixScopeFromChecks(checks);
  if (live.preserve.length > 0 || live.repair.length > 0) return live;
  const repair = new Map<string, FixRepair>();
  for (const lesson of lessons) {
    const match = lesson.reason.trim().match(CHECK_REASON);
    if (!match) continue;
    const reason = match[2].trim();
    repair.set(match[1], { id: match[1], ...(reason ? { reason } : {}) });
  }
  return { preserve: [], repair: [...repair.values()] };
}

/** One line per failed check, covering every earlier attempt on this card. */
export function fixMistakeLines(lessons: ReadonlyArray<{ reason: string }>): string[] {
  const groups = new Map<string, string[]>();
  for (const lesson of lessons) {
    const reason = lesson.reason.trim();
    if (!reason) continue;
    const match = reason.match(CHECK_REASON);
    const id = match?.[1] ?? "other";
    const detail = (match?.[2] ?? reason).trim();
    if (!detail) continue;
    const bucket = groups.get(id) ?? [];
    bucket.push(detail);
    groups.set(id, bucket);
  }
  if (groups.size === 0) return [];
  const lines = ["Mistakes already recorded for this card. Do not fail these checks again:"];
  for (const [id, details] of groups) {
    const unique: string[] = [];
    for (const detail of details) {
      if (!unique.includes(detail)) unique.push(detail);
    }
    const label = id === "other" ? "Other mistakes" : id;
    lines.push(`${label} failed ${details.length} time(s). ${unique.slice(-2).join(" | ")}`);
  }
  return lines;
}

/** Summarize failures that are still open. A check that already passed stays out of this list. */
export function openMistakeLines(
  lessons: ReadonlyArray<{ reason: string }>,
  scope: FixScope,
): string[] {
  const preserve = new Set(scope.preserve);
  const open = lessons.filter((lesson) => {
    const match = lesson.reason.trim().match(CHECK_REASON);
    if (!match) return false;
    return !preserve.has(match[1]);
  });
  return fixMistakeLines(open);
}

export function fixScopeLines(scope: FixScope): string[] {
  if (scope.repair.length === 0) return [];
  const preserve = scope.preserve.length === 0 ? "(none)" : scope.preserve.join("\n");
  const repair = scope.repair
    .map((check) => (check.reason ? `${check.id}: ${check.reason}` : check.id))
    .join("\n");
  const onlyRepair = scope.repair.length === 1 ? scope.repair[0]?.id : "";
  const stakeOnly = onlyRepair === "stakeHolds";
  const premiseOnly = onlyRepair === "premise";
  return [
    "Change only the checks listed under Checks to repair.",
    "Every check listed under Checks that already passed must stay passed.",
    ...(stakeOnly
      ? [
          "Replace the scene. If the distinctive stake named in the failed check is deleted, the sentence must stop making sense.",
          "Naming that stake inside the sentence is not enough. A different situation is allowed. Do not keep the old scene.",
        ]
      : premiseOnly
        ? [
            "Replace the unsupported specific empirical claim with an ordinary defensible premise, reason, or evidence.",
            "A different supporting reason is allowed when the old one depends on invented certainty, exact quantities, universal guarantees, or facts that need separate proof.",
            "New material information that the Master Thought does not already state is allowed.",
            "Keep the because-clause job: the sentence must still explain why the Master Thought is true.",
          ]
        : ["Keep the meaning that made those passed checks true. Do not replace it with a different kind of statement."]),
    ...(onlyRepair === "resolved"
      ? ["Finish only the incomplete sentence. Keep the claim that already passed."]
      : []),
    ...(onlyRepair === "relation"
      ? ["Change only the part that restates, unpacks, or executes the Master Thought. Keep the distinct support that already passed."]
      : []),
    ...(onlyRepair === "role"
      ? ["Name only the premise, reason, or evidence. Keep the sentence that already passed."]
      : []),
    ...(onlyRepair === "explains"
      ? ["Change only the part that does not show why the Master Thought is true. Keep the support that already passed."]
      : []),
    ...(onlyRepair === "duplicate"
      ? ["Move only the part that repeats a Big Thought that already passed."]
      : []),
    ...(onlyRepair === "sibling"
      ? ["Move only the boundary so this Big Thought no longer does the same reasoning job as its sibling."]
      : []),
    ...(onlyRepair === "siblingsDistinct"
      ? ["Move only the boundary so the statement no longer covers the sibling named in the failed check."]
      : []),
    ...(onlyRepair === "audienceLanguage"
      ? ["Change only the name into the words the audience would use for this same area."]
      : []),
    ...(onlyRepair === "partOfBigThought"
      ? ["Keep this area inside the Big Thought. Change only the part that copies a keyword from the Big Thought."]
      : []),
    ...(onlyRepair === "questionArises"
      ? ["Keep the same area. Change it only so the question the Big Thought answers actually comes up there."]
      : []),
    ...(onlyRepair === "wideEnough"
      ? ["Widen only the boundary so this area can hold several different Angles. Keep the audience name that already passed."]
      : []),
    ...(onlyRepair === "observationJob"
      ? ["Remove only the because-reason or the restatement of the parent. Keep the observation that already passed."]
      : []),
    ...(onlyRepair === "ownSubject"
      ? ["Write only a short subject for the same observation. Do not use the Territory's name. Keep the observation sentence."]
      : []),
    ...(onlyRepair === "livedExample"
      ? ["Write only one concrete situation a person could point at. Keep the observation sentence and the short subject."]
      : []),
    ...(onlyRepair === "situationFelt"
      ? [
          "Remove only the verbal explanation. Keep the comparison, contrast, experiment, demonstration, or situation, and keep what the mechanism makes true.",
          "Do not say that this shows, proves, or highlights a conclusion. Do not use menunjukkan bahwa, membuktikan bahwa, or menyoroti bahwa.",
        ]
      : []),
    ...(onlyRepair === "causeLock"
      ? ["Rewrite only the keys that close the other explanations. Keep the sentence that already passed."]
      : []),
    ...(onlyRepair === "messageStays"
      ? [
          "Change only the lines that add a claim or drop the Idea's message. Keep every line that already kept the message.",
          "A line may keep one part of the Idea. Do not rewrite it only because it does not repeat the whole Idea.",
          "Keep this pillar's image, label, and way of speaking when the Idea stays the same.",
          "An earlier failure that only objects to this pillar's image, label, or way of speaking is not a mistake. Keep that image.",
          "An earlier failure that only says a line dropped the Idea because it did not repeat every part is not a mistake.",
          "Changing the only measure into the main measure, or turning the result into a broader claim, is still a claim.",
        ]
      : []),
    ...(onlyRepair === "causeChain"
      ? ["Change only the lines that install another cause. Keep the Big Thought's stake as the cause."]
      : []),
    ...(onlyRepair === "viewerClimb"
      ? ["Change only the lines that lead to another conclusion. Keep the climb toward the Master Thought."]
      : []),
    "Checks that already passed:",
    preserve,
    "Checks to repair:",
    repair,
  ];
}
