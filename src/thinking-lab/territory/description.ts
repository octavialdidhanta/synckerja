import { becauseConnector } from "@/thinking-lab/big-thought/because";

export type TerritoryDescriptions = {
  areaLead: string;
  area: string;
  passLead: string;
  pass: string;
};

function embedClause(value: string): string {
  const text = value.trim().replace(/[.。]+$/g, "").trim();
  const first = text.charAt(0);
  const second = text.charAt(1);
  const secondIsLowerLetter = second !== "" && second === second.toLowerCase() && second !== second.toUpperCase();
  if (first !== first.toLowerCase() && secondIsLowerLetter) return first.toLowerCase() + text.slice(1);
  return text;
}

const empty: TerritoryDescriptions = { areaLead: "", area: "", passLead: "", pass: "" };

export function territoryDescriptions(territory: string, parentReason: string): TerritoryDescriptions {
  const name = territory.trim().replace(/[.。]+$/g, "").trim();
  const reason = embedClause(parentReason);
  if (!name) return empty;
  if (becauseConnector(`${name} ${parentReason}`) === "karena") {
    return {
      areaLead: "Di area ini:",
      area: reason ? `di sini pertanyaan yang dijawab ${reason} muncul langsung di ${name}.` : "",
      passLead: "Lolos pemeriksaan.",
      pass: `${name} menunjuk ruang konkret tempat alasan itu bisa dirasakan langsung, cukup luas untuk beberapa Angle.`,
    };
  }
  return {
    areaLead: "In this area:",
    area: reason ? `the question answered by ${reason} shows up directly in ${name}.` : "",
    passLead: "Passed review.",
    pass: `${name} names a concrete space where that reason can be felt directly, wide enough for several Angles.`,
  };
}
