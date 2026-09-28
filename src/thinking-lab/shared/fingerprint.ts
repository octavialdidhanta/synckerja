export function normalizeFingerprintLine(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function masterThoughtFingerprint(input: { statement: string; rootBelief: string }): string {
  return [normalizeFingerprintLine(input.statement), normalizeFingerprintLine(input.rootBelief)].join("\n");
}

export function bigThoughtFingerprint(input: {
  statement: string;
  masterThoughtFingerprint: string;
}): string {
  const own = normalizeFingerprintLine(input.statement);
  const parent = input.masterThoughtFingerprint.trim();
  return parent ? `${own}\n${parent}` : own;
}

export function territoryFingerprint(input: {
  statement: string;
  bigThoughtFingerprint: string;
}): string {
  const own = normalizeFingerprintLine(input.statement);
  const parent = input.bigThoughtFingerprint.trim();
  return parent ? `${own}\n${parent}` : own;
}

export function angleFingerprint(input: {
  statement: string;
  territoryFingerprint: string;
}): string {
  const own = normalizeFingerprintLine(input.statement);
  const parent = input.territoryFingerprint.trim();
  return parent ? `${own}\n${parent}` : own;
}

export function ideaFingerprint(input: { statement: string; angleFingerprint: string }): string {
  const own = normalizeFingerprintLine(input.statement);
  const parent = input.angleFingerprint.trim();
  return parent ? `${own}\n${parent}` : own;
}

export function ideaSetFingerprint(input: { angleFingerprint: string; ideaFingerprints: string[] }): string {
  const sorted = input.ideaFingerprints.map((row) => row.trim()).filter(Boolean).sort();
  return [input.angleFingerprint.trim(), ...sorted].join("\n\n");
}

export function executionFingerprint(input: { statement: string; ideaFingerprint: string; pillar: string }): string {
  const own = normalizeFingerprintLine(input.statement);
  return [own, input.pillar.trim(), input.ideaFingerprint.trim()].filter(Boolean).join("\n");
}

export function angleSetFingerprint(input: {
  territoryFingerprint: string;
  angleFingerprints: string[];
}): string {
  const sorted = input.angleFingerprints.map((row) => row.trim()).filter(Boolean).sort();
  return [input.territoryFingerprint.trim(), ...sorted].join("\n\n");
}

export function territorySetFingerprint(input: {
  bigThoughtFingerprint: string;
  territoryFingerprints: string[];
}): string {
  const sorted = input.territoryFingerprints.map((row) => row.trim()).filter(Boolean).sort();
  return [input.bigThoughtFingerprint.trim(), ...sorted].join("\n\n");
}

export function incumbentSetFingerprint(input: {
  masterThoughtFingerprint: string;
  bigThoughtFingerprints: string[];
}): string {
  const sorted = input.bigThoughtFingerprints.map((row) => row.trim()).filter(Boolean).sort();
  return [input.masterThoughtFingerprint.trim(), ...sorted].join("\n\n");
}

export function fingerprintsMatch(stored: string | null | undefined, current: string): boolean {
  const left = (stored ?? "").trim();
  const right = current.trim();
  return left.length > 0 && left === right;
}
