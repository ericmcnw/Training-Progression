// Shared gear-picker types — kept dependency-free so form drafts (localStorage)
// and the React picker can both reference them without importing server code.

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
