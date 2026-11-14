// What a Big Thought stores about its Territories (thinking_lab_big_thoughts.territory_set). The shape and the
// helpers are shared with the other levels (shared/cardSetRecord.ts); this file names them for Territory.
// Relative imports only: the MCP server loads this file.
import { readTerritoryCheckId, type TerritoryPassCheckId } from "./passChecklist";
import {
  CARD_REVISION_CAP,
  canReviseCard,
  cardVerdict,
  emptyCardSetRecord,
  mergeCardLessons,
  readCardSetRecord,
  withCardResult,
  withCardRevision,
  withoutCard,
  type CardAuditItem,
  type CardAuditLesson,
  type CardGateFailure,
  type CardSetRecord,
} from "../shared/cardSetRecord";

const SCHEMA = "thinking-lab/territory-set/v1";

export type TerritoryGateFailure = CardGateFailure<TerritoryPassCheckId>;
export type TerritoryAuditItem = CardAuditItem<TerritoryPassCheckId>;
export type TerritoryAuditLesson = CardAuditLesson;
export type TerritorySetRecord = CardSetRecord<typeof SCHEMA, TerritoryPassCheckId>;

export const TERRITORY_REVISION_CAP = CARD_REVISION_CAP;

export const emptyTerritorySetRecord = (): TerritorySetRecord => emptyCardSetRecord(SCHEMA);
export const mergeTerritoryAuditLessons = mergeCardLessons;
export const territoryVerdict = cardVerdict;
export const withTerritoryResult = (
  record: TerritorySetRecord,
  input: Parameters<typeof withCardResult<TerritorySetRecord, TerritoryPassCheckId>>[1],
) => withCardResult<TerritorySetRecord, TerritoryPassCheckId>(record, input);
export const withoutTerritory = (record: TerritorySetRecord, code: string) => withoutCard(record, code);
export const canReviseTerritory = canReviseCard;
export const withTerritoryRevision = (record: TerritorySetRecord, code: string) => withCardRevision(record, code);
export const readTerritorySetRecord = (raw: unknown): TerritorySetRecord => readCardSetRecord(raw, SCHEMA, readTerritoryCheckId);
