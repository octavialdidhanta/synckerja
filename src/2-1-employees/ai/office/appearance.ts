export type OfficeAppearance = {
  skin: string;
  hair: string;
  shirt: string;
  hairStyle: number;
  glasses: boolean;
};

const SKIN = ["#f6d3b4", "#e7b892", "#c68642", "#8d5524"];
const HAIR = ["#1c1917", "#3f2a1d", "#6b3a22", "#111827", "#7c2d12"];
const SHIRT = ["#1d4ed8", "#0f766e", "#b45309", "#6d28d9", "#be123c", "#1e3a8a"];

function hashId(id: string): number {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 33 + id.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function appearanceFromId(id: string): OfficeAppearance {
  const hash = hashId(id);
  return {
    skin: SKIN[hash % SKIN.length] ?? SKIN[0],
    hair: HAIR[(hash >> 3) % HAIR.length] ?? HAIR[0],
    shirt: SHIRT[(hash >> 6) % SHIRT.length] ?? SHIRT[0],
    hairStyle: (hash >> 9) % 4,
    glasses: (hash >> 12) % 4 === 0,
  };
}

export const BAY_CARPETS = ["#eadcc8", "#dce8e1", "#e6deee", "#dfe6f2", "#f0e0cf"];
