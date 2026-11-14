// What a Territory stores about its Angles (thinking_lab_territories.angle_set). The shape and the helpers
// are shared with the other levels (shared/cardSetRecord.ts); this file names them for Angle.
// Relative imports only: the MCP server loads this file.
import { readAngleCheckId, type AnglePassCheckId } from "./passChecklist";
import {
  CARD_REVISION_CAP,
  canReviseCard,
  cardRevisionsUsed,
  cardVerdict,
  emptyCardSetRecord,
  mergeCardLessons,
  readCardGateFailure,
  readCardSetRecord,
  withCardResult,
  withCardRevision,
  withoutCard,
  type CardAuditItem,
  type CardAuditLesson,
  type CardGateFailure,
  type CardSetRecord,
} from "../shared/cardSetRecord";

const SCHEMA = "thinking-lab/angle-set/v1";

export type AngleGateFailure = CardGateFailure<AnglePassCheckId>;
export type AngleAuditItem = CardAuditItem<AnglePassCheckId>;
export type AngleAuditLesson = CardAuditLesson;
export type AngleSetRecord = CardSetRecord<typeof SCHEMA, AnglePassCheckId>;

export const ANGLE_REVISION_CAP = CARD_REVISION_CAP;

export const emptyAngleSetRecord = (): AngleSetRecord => emptyCardSetRecord(SCHEMA);
export const mergeAngleAuditLessons = mergeCardLessons;
export const angleVerdict = cardVerdict;
export const withAngleResult = (record: AngleSetRecord, input: Parameters<typeof withCardResult<AngleSetRecord, AnglePassCheckId>>[1]) =>
  withCardResult<AngleSetRecord, AnglePassCheckId>(record, input);
export const withoutAngle = (record: AngleSetRecord, code: string) => withoutCard(record, code);
export const angleRevisionsUsed = cardRevisionsUsed;
export const canReviseAngle = canReviseCard;
export const withAngleRevision = (record: AngleSetRecord, code: string) => withCardRevision(record, code);
export const readAngleGateFailure = (value: unknown) => readCardGateFailure(value, readAngleCheckId);
export const readAngleSetRecord = (raw: unknown): AngleSetRecord => readCardSetRecord(raw, SCHEMA, readAngleCheckId);
