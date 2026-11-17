import type { CSSProperties } from "react";

// One look for every page's back link and title. Pages import these instead
// of declaring their own so placement and weight stay the same app-wide:
// back link top-left above the title, "← Parent" as the label.
export const backLinkStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifySelf: "start",
  alignSelf: "start",
  minHeight: 32,
  fontSize: 13,
  fontWeight: 800,
  color: "inherit",
  opacity: 0.65,
  textDecoration: "none",
};

export const pageTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 26,
  fontWeight: 900,
  lineHeight: 1.15,
};
