import Link from "next/link";
import SchedulePage from "@/app/schedule/page";
import GoalsPage from "@/app/goals/[[...segments]]/page";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

// Phase 2: the new Plan tab. Combines the existing Schedule and Goals pages
// behind a single nav entry, with internal tab switching. The existing
// /schedule and /goals routes remain valid (linked from many places); /plan
// is the unified entry point introduced for the new top-level navigation.
export default async function PlanPage(props: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const searchParams = await Promise.resolve(props.searchParams ?? {});
  const view = (getParam(searchParams, "view") ?? "schedule").toLowerCase();

  // Both embedded pages (Schedule and Goals) render their own headings, so /plan
  // surfaces a thin tab strip above the embed instead of duplicating the title.
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <PlanTabs current={view} />
      {view === "goals" ? (
        <GoalsPage params={Promise.resolve({})} searchParams={Promise.resolve(searchParams)} />
      ) : (
        <SchedulePage searchParams={Promise.resolve(searchParams)} />
      )}
    </div>
  );
}

function PlanTabs({ current }: { current: string }) {
  const tabs: Array<{ key: string; label: string; href: string }> = [
    { key: "schedule", label: "Schedule", href: "/plan?view=schedule" },
    { key: "goals", label: "Goals", href: "/plan?view=goals" },
  ];

  return (
    <nav
      aria-label="Plan views"
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
            }}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
