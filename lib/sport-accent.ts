// Single source of truth for sport accent colors. Used by the schedule
// picker, /log SPORT section, MonthTab dots, goal target tiles, and the
// SupportsSportsField. If you add a sport here, the palette propagates to
// every surface that imports SPORT_ACCENT — keep this aligned with the
// segment colors in lib/activities/sports-chart.ts.

export const SPORT_ACCENT: Record<string, string> = {
  climbing: "rgba(251,146,60,0.9)",
  surfing: "rgba(56,189,248,0.9)",
  bodysurfing: "rgba(2,132,199,0.9)",
  snowboarding: "rgba(168,85,247,0.9)",
  skiing: "rgba(99,102,241,0.9)",
  skateboarding: "rgba(244,114,182,0.9)",
  basketball: "rgba(220,38,38,0.9)",
  spikeball: "rgba(250,204,21,0.9)",
  tennis: "rgba(132,204,22,0.9)",
  golf: "rgba(40,212,160,0.9)",
};

export const SPORT_ACCENT_FALLBACK = "rgba(255,255,255,0.5)";

export function sportAccent(slug: string): string {
  return SPORT_ACCENT[slug] ?? SPORT_ACCENT_FALLBACK;
}
