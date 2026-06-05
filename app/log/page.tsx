import Link from "next/link";
import { redirect } from "next/navigation";
import RoutinesPage from "@/app/routines/page";
import SportsLogSection from "./SportsLogSection";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

// Phase 2: the new Log tab. Today's routines list lives at /routines and is
// already the user's primary log surface. Rather than fork it, /log embeds
// /routines and adds a tab strip for switching between Routines / Exercises /
// Quick Log views. Phase 3 will rebuild the page natively as the canonical
// Log surface and redirect /routines → /log.
export default async function LogPage(props: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const searchParams = await Promise.resolve(props.searchParams ?? {});
  const view = (getParam(searchParams, "view") ?? "routines").toLowerCase();

  if (view === "exercises") {
    // The exercise library has its own home at /exercises now (no
    // /progress hop). Phase 3 may rebuild this as a tab embed inside
    // /log; for now we just forward.
    redirect("/exercises");
  }

  // The embedded RoutinesPage renders its own "Routines" heading, so /log
  // surfaces a thin tab strip above the embed instead of duplicating the title.
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <LogTabs current={view} />
      {/* Sports section — type-based quick-log surface, parallel to
          the routine-based logging the embed below covers. Lives above
          the routines list so the user can drop a Climbing session in
          without scrolling past their strength templates. */}
      <SportsLogSection />
      <RoutinesPage searchParams={Promise.resolve(searchParams)} />
    </div>
  );
}

function LogTabs({ current }: { current: string }) {
  const tabs: Array<{ key: string; label: string; href: string; description: string }> = [
    {
      key: "routines",
      label: "Routines",
      href: "/log?view=routines",
      description: "Your training templates",
    },
    {
      key: "exercises",
      label: "Exercises",
      href: "/log?view=exercises",
      description: "Exercise library",
    },
  ];

  return (
    <nav
      aria-label="Log views"
      style={{
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        padding: "4px 4px",
      }}
    >
      {tabs.map((tab) => {
        const active = current === tab.key;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            style={{
              padding: "8px 14px",
              borderRadius: 12,
              fontSize: 13,
              fontWeight: 800,
              textDecoration: "none",
              border: active
                ? "1px solid rgba(51,255,122,0.45)"
                : "1px solid rgba(255,255,255,0.12)",
              background: active ? "rgba(51,255,122,0.10)" : "rgba(255,255,255,0.04)",
              color: active ? "rgba(51,255,122,0.95)" : "inherit",
              transition: "border-color 120ms ease, background 120ms ease",
            }}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
