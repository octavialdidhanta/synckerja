// Parts of the Idea checks decided in code, without a model call: the sentence form, an announced
// conclusion, and the guards that keep a model's off-rule failure from counting.
// Relative imports only: the MCP server loads this file.
import type { IdeaPeer } from "./memory";

const ID_HINT =
  /\b(yang|dan|untuk|dengan|dari|ini|tidak|agar|pada|dalam|adalah|atau|para|sebuah|seringkali|sering|lebih|daripada|tentang|bukan|hanya|justru|padahal|juga|kita|di|ke|bisa|sangat|dianggap|tetap)\b/gi;
const EN_HINT = /\b(the|and|with|from|this|that|without|when|because|does|into)\b/gi;
// "Kita [bikin/ajak/tunjukkan/ciptakan] … sehingga …". The older "Bagaimana jika" stays valid.
const INDONESIAN_OPENING = /^\s*(bagaimana\s+jika\b|kita\s+\S+[\s\S]*\bsehingga\b)/i;
const ENGLISH_OPENING = /^\s*(what\s+if\b|we\s+\S+[\s\S]*\bso\s+that\b)/i;
const ANY_OPENING = /^\s*((bagaimana\s+jika|what\s+if)\b|kita\s+\S+[\s\S]*\bsehingga\b|we\s+\S+[\s\S]*\bso\s+that\b)/i;

function angleLanguage(statement: string): "id" | "en" | "other" {
  const indonesian = statement.match(ID_HINT)?.length ?? 0;
  const english = statement.match(EN_HINT)?.length ?? 0;
  if (indonesian > english) return "id";
  if (english > indonesian) return "en";
  return "other";
}

/** Indonesian text when the Angle is Indonesian, English otherwise. */
export function inAngleLanguage(angle: string, indonesian: string, english: string): string {
  return angleLanguage(angle) === "id" ? indonesian : english;
}

export function hasHowIfOpening(statement: string, angleStatement: string): boolean {
  const language = angleLanguage(angleStatement);
  if (language === "id") return INDONESIAN_OPENING.test(statement);
  if (language === "en") return ENGLISH_OPENING.test(statement);
  return ANY_OPENING.test(statement);
}

export function howIfInstruction(angleStatement: string): string {
  const language = angleLanguage(angleStatement);
  if (language === "id")
    return 'Write the statement as "Kita [bikin/ajak/tunjukkan/ciptakan] … sehingga …": what we make happen, then what it makes true.';
  if (language === "en") return 'Write the statement as "We [make/invite/show/create] … so that …": what we make happen, then what it makes true.';
  return 'Write the statement in the same language as the Angle. In Indonesian the form is "Kita [bikin/ajak/tunjukkan/ciptakan] … sehingga …"; in English "We [make/invite/show/create] … so that …".';
}

export const ANNOUNCED_CONCLUSION =
  /\b(?:menunjukkan bahwa|membuktikan bahwa|menyoroti bahwa|ini hanya menunjukkan|highlights that|shows that|proves that)\b/i;
const INDONESIAN_ANNOUNCEMENT = /\b(?:menunjukkan bahwa|membuktikan bahwa|menyoroti bahwa|ini hanya menunjukkan)\b/i;

/** The sentence announces a conclusion. Stating what the mechanism makes true does not match. */
export function ideaAnnouncesConclusion(statement: string): boolean {
  return ANNOUNCED_CONCLUSION.test(statement);
}

export function announcedConclusionReason(statement: string): string {
  if (INDONESIAN_ANNOUNCEMENT.test(statement)) {
    return "Kalimat ini mengumumkan kesimpulannya. Tetap tulis apa yang menjadi benar, tanpa menunjukkan, membuktikan, atau menyoroti bahwa.";
  }
  return "The sentence announces the conclusion. Keep what becomes true without saying that this shows, proves, or highlights it.";
}

/** A proposal failure counts when it says the sentence is not a proposal; an unusual action is not one. */
export function proposalFailCounts(reason: string): boolean {
  const notProposal =
    /bukan (proposal|usulan)|not a (how-if|proposal)|hanya fakta|only a fact|hanya masalah|only a problem|hanya tujuan|only a goal|hanya aktivitas|only an activity|hanya teknik|only a technique|general strategy|strategi umum|tidak menyebut|does not (name|say)/i.test(
      reason,
    );
  if (notProposal) return true;
  return !/kehidupan sehari-hari|ordinary life|tidak biasa|unusual/i.test(reason);
}

/** A result failure counts when the result breaks; not solving the whole Angle is not this check. */
export function resultFailCounts(reason: string): boolean {
  const solvesAngle =
    /tidak secara langsung (mengatasi|menjamin|menyelesaikan|mengubah)|does not directly (solve|guarantee|overcome|fix)|tidak mengatasi (seluruh )?masalah|does not solve the (whole )?problem/i.test(
      reason,
    );
  const breaks = /tidak mengikuti|does not follow|kontradiksi|contradiction|menjelaskan|explains|mengumumkan|announces/i.test(reason);
  return !solvesAngle || breaks;
}

const AUDIENCE_BARRIER =
  /\baudiens\b|\baudience\b|\bkebiasaan\b|\bhabit\b|kehidupan sehari-hari|ordinary life|\bprofesi\b|\bprofession\b|\bkomitmen\b|\bcommitment\b|\bketerampilan\b|\bskill\b|tidak bisa disiapkan|cannot prepare|tidak realistis|unrealistic|\bsumber daya\b|\bresources\b|\bmengadopsi\b|\badopt\b/i;

/** A watchable failure counts only when it names a barrier this audience cannot prepare. */
export function watchableFailCounts(reason: string): boolean {
  return AUDIENCE_BARRIER.test(reason);
}

const AUDIENCE_ACTION_GROUPS: ReadonlyArray<readonly [string, RegExp]> = [
  ["tell", /menceritakan|bercerita|menuturkan|\btelling\b|narrat/i],
  ["record", /mencatat|menulis|\brecord(?:ing)?\b|\blogging\b/i],
  ["compare", /membandingkan|\bcompar/i],
  ["ask", /bertanya|menanyakan|\bask(?:ing)?\b/i],
  ["look", /melihat|menonton|memandang|\blook(?:ing)?\b|\bwatch(?:ing)?\b/i],
  ["feel", /menyentuh|meraba|menekan|\btouch(?:ing)?\b|\bpress(?:ing)?\b|\bfeel(?:ing)?\b/i],
  ["read", /membaca|\bread(?:ing)?\b/i],
  ["hear", /mendengar|mendengarkan|\bhear(?:ing)?\b|\blisten(?:ing)?\b/i],
  ["choose", /memilih|\bchoos(?:e|ing)\b/i],
  ["discuss", /berdiskusi|mendiskusikan|membahas|\bdiscuss/i],
  ["show", /menampilkan|memperlihatkan|\bshow(?:ing)?\b|\bdisplay/i],
];

function audienceActions(text: string): string[] {
  return AUDIENCE_ACTION_GROUPS.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
}

/** Both texts name an audience action, and the actions are not the same set. */
function audienceActionsDiffer(left: string, right: string): boolean {
  const a = audienceActions(left);
  const b = audienceActions(right);
  if (a.length === 0 || b.length === 0) return false;
  if (a.length !== b.length) return true;
  return a.some((action) => !b.includes(action));
}

/** The reason names one action, then calls a different action mere emphasis. */
function foldsDifferentAction(reason: string): boolean {
  const parts = reason.split(/hanya berbeda pada|only differs in|only different in|\bpenekanan\b|\bemphasis\b/i);
  if (parts.length < 2) return false;
  const before = audienceActions(parts[0] ?? "");
  const after = audienceActions(parts.slice(1).join(" "));
  return after.some((action) => !before.includes(action));
}

function assertsSameConcept(reason: string): boolean {
  return /\bsama\b|\bsame\b|duplikat|duplicate|mengulang|repeats|tidak berbeda|not different|tidak bisa dibedakan|cannot be told apart|hanya judul|only the title|only the wording|visualisasi|visualization|\bemphasis\b|penekanan/i.test(
    reason,
  );
}

/** A distinct failure counts only when it names another passed Idea whose audience action is the same. */
export function distinctFailCounts(reason: string, peers: readonly IdeaPeer[], current: { statement: string; mechanism?: string }): boolean {
  if (foldsDifferentAction(reason) || !assertsSameConcept(reason)) return false;
  const cited = peers.filter((peer) => peer.code && new RegExp(`\\b${peer.code}\\b`, "i").test(reason));
  if (cited.length === 0) return false;
  const currentText = `${current.mechanism ?? ""} ${current.statement}`;
  return !cited.some((peer) => audienceActionsDiffer(currentText, `${peer.mechanism} ${peer.statement}`));
}
