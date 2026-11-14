/** The node of the Thinking Lab tree that is open in the inspector. */
export type LabFocus =
  | { kind: "master"; masterId: string }
  | { kind: "bigThought"; masterId: string; thoughtId: string }
  | { kind: "territory"; masterId: string; thoughtId: string; territoryId: string }
  | { kind: "angle"; masterId: string; thoughtId: string; territoryId: string; angleId: string }
  | { kind: "idea"; masterId: string; thoughtId: string; territoryId: string; angleId: string; ideaId: string }
  | { kind: "pillar"; masterId: string; thoughtId: string; territoryId: string; angleId: string; ideaId: string; contentPillarId: string }
  | { kind: "execution"; masterId: string; thoughtId: string; territoryId: string; angleId: string; ideaId: string; executionId: string };
