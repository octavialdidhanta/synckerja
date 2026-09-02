export type {
  PosFloorFixture,
  PosFloorFixtureType,
  FixtureFootprint,
} from "./lib/posFloorFixtureTypes";
export {
  POS_FLOOR_FIXTURE_TYPES,
  FIXTURE_DEFAULT_FOOTPRINT,
  FIXTURE_SIZE_EDITABLE_ON_ADD,
  EDGE_STRIP_FIXTURE_TYPES,
  LENGTH_RESIZABLE_FIXTURE_TYPES,
  FIXED_CELL_FIXTURE_TYPES,
} from "./lib/posFloorFixtureTypes";
export {
  usePosFloorFixtures,
  POS_FLOOR_FIXTURES_QUERY_KEY,
} from "./hooks/usePosFloorFixtures";
export { TableMapFixtureNode } from "./components/TableMapFixtureNode";
export { FixtureShapeBody } from "./components/FixtureShapeBody";
export { AddFloorFixtureDialog } from "./components/AddFloorFixtureDialog";
export type { FloorFixtureDialogValues } from "./components/AddFloorFixtureDialog";
export {
  FIXTURE_VISUALS,
  fixtureTypeFallback,
  fixtureTypeLabelKey,
} from "./lib/fixtureVisuals";
export { nextFixtureName } from "./lib/fixtureNaming";
export {
  defaultFootprintForType,
  applyFixtureRotation,
  findFixtureFreeCell,
  fixtureAxisBox,
  edgeStripLayout,
  isEdgeStripFixtureType,
  isFixedCellFixtureType,
  normalizeEdgeStripFootprint,
  normalizeFixedCellFootprint,
  resizeFixtureAlongAxis,
} from "./lib/fixtureLayout";
export type { OccupancyBox, FixtureRect, FixtureLengthEdge } from "./lib/fixtureLayout";
