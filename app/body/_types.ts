// Re-export the underlying lib type under the local name BodyPageClient uses.
// Lives in its own module (not inside _actions.ts) because "use server" files
// can't safely export types — Next.js' server-actions loader strips them and
// referencing the re-exported name at runtime crashes.

export type { ZoneGroupDetailResult as ZoneDetailResult } from "@/lib/body-zones";
