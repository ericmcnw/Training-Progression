// Shared types for the SpotPicker component + draft persistence.
//
// Lives in lib/ (not co-located with the component) so the draft schema
// in lib/log-draft.ts can reference the picker's value shape without
// creating a circular dependency between the form draft module and the
// React component module.

export type SpotPickerSavedRef = {
  kind: "activitySpot" | "climbLocation";
  id: string;
};

export type SpotPickerNewDraft = {
  source: "osm" | "custom";
  name: string;
  type: string | null;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  osmType: string | null;
  osmId: string | null;
  // Display name of the OSM-pinned location, separate from the spot's own
  // name. Lets the picker show "Pinned to Clinton Road" even when the
  // user has renamed the spot itself to "Clinton road boulder." Purely a
  // client-side hint — recoverable from osmId so we don't persist it
  // to the server.
  osmName?: string | null;
};

export type SpotPickerValue =
  | {
      kind: "saved";
      ref: SpotPickerSavedRef;
      display: { name: string; region: string | null };
    }
  | { kind: "new"; draft: SpotPickerNewDraft }
  | null;
