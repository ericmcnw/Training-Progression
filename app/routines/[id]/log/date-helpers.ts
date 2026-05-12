// Pure date helpers for the routine-log page. Lives in its own module
// (without "use client") so the server-rendered LogRoutinePage can call
// localDateTimeForYmd directly when seeding form defaults from a ?date=
// query param. Previously this helper lived in form-ui.tsx, which carries
// "use client" — importing it from a server file caused a runtime crash.

/** Build a datetime-local input value for a given YYYY-MM-DD at a specific
 *  hour:minute. Used by retroactive logging — the WaG detail card and the
 *  goal heatmap pass `?date=` to the log page; we default to noon since the
 *  real time of day is unknown. */
export function localDateTimeForYmd(ymd: string, hour = 12, minute = 0): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${ymd}T${pad(hour)}:${pad(minute)}`;
}
