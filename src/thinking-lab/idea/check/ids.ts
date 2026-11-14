// The seven Idea checks, in the order they run. Relative imports only: the MCP server loads this file.

export const IDEA_CHECK_IDS = [
  "proposal",
  "mechanism",
  "result",
  "stakeHolds",
  "causeLock",
  "watchable",
  "distinct",
] as const;

export type IdeaCheckId = (typeof IDEA_CHECK_IDS)[number];

export function isIdeaCheckId(value: string): value is IdeaCheckId {
  return (IDEA_CHECK_IDS as readonly string[]).includes(value);
}

/**
 * The fifteen earlier switches (eight pass checks and K1-K7) folded into the seven checks.
 * A new check starts ON when any switch it replaced was ON.
 */
export const LEGACY_IDEA_SWITCHES: Readonly<Record<IdeaCheckId, readonly string[]>> = {
  proposal: ["sentenceForm", "K1"],
  mechanism: ["mechanismShape", "vehicle", "recognizable"],
  result: ["situationFelt", "K3", "K4"],
  stakeHolds: ["stakeHolds", "K6"],
  causeLock: ["causeLock"],
  watchable: ["K7"],
  distinct: ["siblingsDistinct", "K5"],
};

/** Stored K1-K7 results map to the check that replaced each one. K2 was retired and maps to nothing. */
export const LEGACY_IDEA_CRITERIA: Readonly<Record<string, IdeaCheckId>> = {
  K1: "proposal",
  K3: "result",
  K4: "result",
  K5: "distinct",
  K6: "stakeHolds",
  K7: "watchable",
};
