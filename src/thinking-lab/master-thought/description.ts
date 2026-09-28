import { becauseConnector } from "@/thinking-lab/big-thought/because";

function embedBelief(belief: string): string {
  const text = belief.trim().replace(/[.。]+$/g, "").trim();
  const first = text.charAt(0);
  const second = text.charAt(1);
  const secondIsLowerLetter = second !== "" && second === second.toLowerCase() && second !== second.toUpperCase();
  if (first !== first.toLowerCase() && secondIsLowerLetter) return first.toLowerCase() + text.slice(1);
  return text;
}

export function masterBeliefDescription(belief: string, audience: string): string {
  const planted = belief.trim();
  const people = audience.trim();
  if (!planted) return "";
  if (!people) return planted;
  const embedded = embedBelief(planted);
  if (!embedded) return planted;
  if (becauseConnector(planted) === "karena") return `Kita ingin ${people} percaya bahwa ${embedded}.`;
  return `We want ${people} to believe that ${embedded}.`;
}
