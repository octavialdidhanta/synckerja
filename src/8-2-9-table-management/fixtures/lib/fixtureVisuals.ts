import type { LucideIcon } from "lucide-react";
import {
  CookingPot,
  DoorOpen,
  Footprints,
  Minus,
  MonitorSmartphone,
  SquareParking,
  Store,
  Waves,
} from "lucide-react";
import type { PosFloorFixtureType } from "./posFloorFixtureTypes";

export type FixtureVisual = {
  icon: LucideIcon;
  /** Tailwind classes for fill / border / text */
  fillClass: string;
  borderClass: string;
  iconClass: string;
};

export const FIXTURE_VISUALS: Record<PosFloorFixtureType, FixtureVisual> = {
  cashier: {
    icon: Store,
    fillClass: "bg-amber-100/90",
    borderClass: "border-amber-400",
    iconClass: "text-amber-700",
  },
  stairs: {
    icon: Footprints,
    fillClass: "bg-slate-200/90",
    borderClass: "border-slate-400",
    iconClass: "text-slate-700",
  },
  door: {
    icon: DoorOpen,
    fillClass: "bg-sky-100/90",
    borderClass: "border-sky-400",
    iconClass: "text-sky-700",
  },
  wall: {
    icon: Minus,
    fillClass: "bg-stone-400/95",
    borderClass: "border-stone-600",
    iconClass: "text-stone-800",
  },
  kitchen: {
    icon: CookingPot,
    fillClass: "bg-orange-100/90",
    borderClass: "border-orange-400",
    iconClass: "text-orange-700",
  },
  washbasin: {
    icon: Waves,
    fillClass: "bg-cyan-100/90",
    borderClass: "border-cyan-400",
    iconClass: "text-cyan-700",
  },
  kiosk: {
    icon: MonitorSmartphone,
    fillClass: "bg-violet-100/90",
    borderClass: "border-violet-400",
    iconClass: "text-violet-700",
  },
  parking: {
    icon: SquareParking,
    fillClass: "bg-emerald-100/90",
    borderClass: "border-emerald-400",
    iconClass: "text-emerald-700",
  },
};

export function fixtureTypeLabelKey(type: PosFloorFixtureType): string {
  return `tableManagement.fixture.type.${type}`;
}

export function fixtureTypeFallback(type: PosFloorFixtureType): string {
  const map: Record<PosFloorFixtureType, string> = {
    cashier: "Cashier",
    stairs: "Stairs",
    door: "Door",
    wall: "Wall",
    kitchen: "Kitchen",
    washbasin: "Washbasin",
    kiosk: "Kiosk",
    parking: "Parking",
  };
  return map[type];
}
