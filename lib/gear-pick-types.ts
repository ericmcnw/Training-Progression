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
