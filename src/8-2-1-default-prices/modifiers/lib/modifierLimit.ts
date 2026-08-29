export type ModifierLimitInput = {
  limitEnabled: boolean;
  isRequired: boolean;
  minSelected: number;
  maxSelected: number;
};

export type ModifierLimitNormalized = {
  min: number;
  max: number;
};

function asInt(value: number, fallback: number): number {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? n : fallback;
}

/** Persist / load shape: limit off, optional, or required min+max. */
export function normalizeModifierLimit(input: ModifierLimitInput): ModifierLimitNormalized {
  if (!input.limitEnabled) {
    return { min: 0, max: 1 };
  }
  const max = Math.max(1, asInt(input.maxSelected, 1));
  if (!input.isRequired) {
    return { min: 0, max };
  }
  const min = Math.max(1, asInt(input.minSelected, 1));
  return { min, max: Math.max(min, max) };
}

/** Required-min stepper: floor 1; bump max if min exceeds it. */
export function applyModifierMin(args: {
  minSelected: number;
  maxSelected: number;
}): ModifierLimitNormalized {
  const min = Math.max(1, asInt(args.minSelected, 1));
  const max = Math.max(min, Math.max(1, asInt(args.maxSelected, 1)));
  return { min, max };
}

/** Max stepper: floor 1; if required, pull min down when max goes below min. */
export function applyModifierMax(args: {
  minSelected: number;
  maxSelected: number;
  isRequired: boolean;
}): ModifierLimitNormalized {
  const max = Math.max(1, asInt(args.maxSelected, 1));
  if (!args.isRequired) {
    return { min: 0, max };
  }
  const min = Math.min(Math.max(1, asInt(args.minSelected, 1)), max);
  return { min, max };
}

export function isModifierLimitValid(input: ModifierLimitInput): boolean {
  const { min, max } = normalizeModifierLimit(input);
  if (max < 1) return false;
  if (input.limitEnabled && input.isRequired && min < 1) return false;
  return max >= min;
}
