import { becauseConnector } from "@/thinking-lab/big-thought/because";

function stripEndPunctuation(value: string): string {
  return value.trim().replace(/[.。]+$/g, "").trim();
}

function lowerFirst(value: string): string {
  const text = value.trim();
  if (!text) return "";
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function indonesian(sample: string): boolean {
  return becauseConnector(sample) === "karena";
}

function spokenQuestion(question: string): string {
  return stripEndPunctuation(question)
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .replace(/[?？]+$/g, "")
    .trim();
}

/** Reading sentence: what happens in the Territory, then the question people ask there. */
export function territoryQuestionSentence(
  territory: string,
  question: string,
  languageSample = "",
  scene = "",
): string {
  const place = stripEndPunctuation(territory);
  const ask = spokenQuestion(question);
  if (!place || !ask) return "";
  const situation = stripEndPunctuation(scene);
  const usableScene = situation && situation.toLowerCase() !== place.toLowerCase() ? situation : "";
  const link = indonesian(`${place} ${ask} ${languageSample} ${usableScene}`);
  if (link) {
    return usableScene
      ? `Di ${place}, ${lowerFirst(usableScene)}. Lalu ia bertanya: ${lowerFirst(ask)}?`
      : `Di ${place}, pertanyaannya: ${lowerFirst(ask)}?`;
  }
  return usableScene
    ? `In ${place}, ${lowerFirst(usableScene)}. Then the question is: ${ask}?`
    : `In ${place}, the question is: ${ask}?`;
}

/** Shared generate and audit instruction. The stored Territory stays a noun. */
export function territoryLinkInstruction(question: string, _languageSample = ""): string {
  const ask = question.trim();
  const where = ask
    ? `The name is an area where this question comes up in real life: ${ask}`
    : "The name is an area where the question this Big Thought answers comes up in real life.";
  return [
    "Write a noun or a noun phrase only. Do not write a sentence.",
    where,
    "Kurir paket is the shape of the name. A keyword of the Big Thought is not a name.",
    "Write the name only.",
  ].join(" ");
}
