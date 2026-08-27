// Shared gear-picker types — kept free of server imports so form drafts
// (localStorage) and the React picker can both reference them. The gear-type
// registry is a pure client-safe lookup, so it's fair game.

import { isWornGearType } from "./gear-types";

/** A gear line in the picker's value. String fields mirror the raw inputs so an
 *  in-progress draft round-trips cleanly. `gearId` is set when the line came
 *  from saved inventory (null for a freshly-typed item, resolved on save). */
export type GearPick = {
  localId: string;
  gearId: string | null;
  type: string; // type slug or free text — resolved to a slug on save
  name: string;
  weightOz: string;
  quantity: string;
  consumable: boolean;
};

/** A saved inventory item surfaced in the picker's "your gear" quick-add. */
export type SavedGear = {
  id: string;
  type: string;
  name: string;
  weightGrams: number | null;
  consumable: boolean;
};

const GRAMS_PER_OZ = 28.349523125;

export const GRAMS_PER_LB = 453.59237;

export function lbFromGrams(grams: number): number {
  return Math.round((grams / GRAMS_PER_LB) * 10) / 10;
}

export function gramsFromLb(lb: number): number {
  return Math.round(lb * GRAMS_PER_LB);
}

/** Total carried weight from picked gear, in grams. Lines without a weight
 *  contribute nothing rather than voiding the total — a pack with one
 *  unweighed item should still report the weight it does know. */
export function packWeightGramsFromPicks(picks: GearPick[]): number {
  return picks.reduce((sum, pick) => {
    if (pick.name.trim().length === 0) return sum;
    // Worn on you, not carried by you.
    if (isWornGearType(pick.type)) return sum;
    const oz = Number(pick.weightOz);
    if (!Number.isFinite(oz) || oz <= 0) return sum;
    const qty = pick.quantity.trim() === "" ? 1 : Number(pick.quantity);
    const each = Math.round(oz * GRAMS_PER_OZ);
    return sum + each * (Number.isFinite(qty) && qty > 0 ? qty : 1);
  }, 0);
}

/** Convert picker values to the resolve-on-save input shape (drops blank rows,
 *  oz → grams). Matches `GearPickInput` in lib/gear.ts structurally. */
export function gearToPickInput(picks: GearPick[]): Array<{
  gearId: string | null;
  type: string;
  name: string;
  weightGrams: number | null;
  quantity: number;
  consumable: boolean;
}> {
  return picks
    .filter((p) => p.name.trim().length > 0)
    .map((p) => ({
      gearId: p.gearId,
      type: p.type,
      name: p.name.trim(),
      weightGrams: p.weightOz.trim() === "" ? null : Math.round(Number(p.weightOz) * GRAMS_PER_OZ),
      quantity: p.quantity.trim() === "" ? 1 : Number(p.quantity),
      consumable: p.consumable,
    }));
}
