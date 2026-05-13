// App-wide design tokens. Re-exports from app/_home-v2/tokens for now so the
// home-v2 module remains the source of truth while these tokens get adopted
// across the rest of the app (body, injuries, etc.). Once the home-v2 folder
// is renamed / the prefix dropped, the export site moves here and home-v2
// imports from this module instead.

export {
  COLOR,
  RADIUS,
  SHADOW,
  SECTION_GAP,
  cardSurface,
  cardHeader,
  cardTitle,
  cardHint,
  DOMAIN_LABEL,
} from "@/app/_home-v2/tokens";
