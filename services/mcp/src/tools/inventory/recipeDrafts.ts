import { z } from "zod";

/** Units the database converts: mass and volume families, plus every ingredient unit code. */
export const RECIPE_DRAFT_UNITS = [
  "mg", "g", "ons", "kg", "ml", "l",
  "pcs", "box", "bks", "btr", "cm", "c", "ekr", "fl oz", "gal", "grs", "ikt", "in", "jar", "klg",
  "kds", "ktn", "krg", "crt", "kw", "lbr", "lsn", "m", "oz", "pck", "pt", "prs", "ptg", "lb", "q",
  "sct", "tbsp", "tsp", "tn", "whole",
] as const;

const draftLine = z.object({
  ingredient: z.string().trim().min(1).max(120),
  quantity: z.number().positive().max(100000),
  unit: z.enum(RECIPE_DRAFT_UNITS),
}).strict();

export const recipeDraftCreateInput = z.object({
  menu: z.string().trim().min(1).max(200),
  lines: z.array(draftLine).min(1).max(50),
  request_note: z.string().trim().min(1).max(1000),
  outlet_id: z.string().uuid().optional(),
}).strict();

export const recipeDraftListInput = z.object({
  status: z.enum(["pending", "published", "rejected", "superseded", "expired", "all"]).optional(),
}).strict();

export type RecipeDraftCreate = {
  menu: string;
  lines: Array<{ ingredient: string; quantity: number; unit: string }>;
  requestNote: string;
  outletId: string | null;
};

export function recipeDraftCreate(data: z.infer<typeof recipeDraftCreateInput>): RecipeDraftCreate {
  return {
    menu: data.menu,
    lines: data.lines.map((line) => ({ ingredient: line.ingredient, quantity: line.quantity, unit: line.unit })),
    requestNote: data.request_note,
    outletId: data.outlet_id ?? null,
  };
}

export const RECIPE_DRAFT_HOW_TO_READ = [
  "The draft is saved but NOT active: POS, stock and HPP still use the current recipe.",
  "Tell the user to review and publish it in Synckerja at Operations → Ingredient → Recipes (the draft banner). You cannot publish it.",
  "Show HPP before → after (totals.hpp_before is null for a menu without a recipe), each changed line with its quantity in the ingredient's unit_code, and every item in warnings and blocking.",
  "warnings need the user's confirmation in the app; blocking items (stale, deleted_ingredient, not_pending) must be fixed first.",
  "A newer draft for the same menu replaces the older open one.",
].join(" ");
