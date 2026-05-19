// App-wide design tokens. Source of truth lives in `app/_home/tokens.ts`
// for now (where the dashboard originally consumed them); this module is
// the canonical app-wide import point so non-home surfaces don't need to
// know about the `_home` directory.

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
} from "@/app/_home/tokens";
