// Per-routine series colors for stacked weekly charts. Domain colors can't do
// this job — two strength routines would land on the same green and the
// legend's isolate-on-tap would have nothing to distinguish them by.
//
// Assigned in rank order (biggest series gets the first color). Ordered for
// maximum hue contrast — each adjacent pair is far apart on the color wheel —
// and de-duplicated so there aren't two near-greens or two near-blues anywhere
// in the list. Previously had green+emerald, sky+light-blue, amber+yellow,
// which read as the same color from across the room.
export const ROUTINE_PALETTE = [
  "rgba(84,203,130,0.92)",   // green
  "rgba(251,191,36,0.94)",   // amber
  "rgba(167,139,250,0.94)",  // violet
  "rgba(248,113,113,0.92)",  // red
  "rgba(56,189,248,0.94)",   // sky
  "rgba(251,146,60,0.92)",   // orange
  "rgba(244,114,182,0.92)",  // pink
  "rgba(163,230,53,0.92)",   // lime
  "rgba(34,211,238,0.92)",   // teal
  "rgba(217,70,239,0.92)",   // magenta
];

export function routineColorAt(index: number): string {
  return ROUTINE_PALETTE[index % ROUTINE_PALETTE.length];
}
