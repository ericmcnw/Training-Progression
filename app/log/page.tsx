import Link from "next/link";
import { redirect } from "next/navigation";
import RoutinesPageContent from "@/app/routines/RoutinesPageContent";
import LogHistory from "./LogHistory";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function getParam(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

// /log is the canonical log surface — the routines list (now hosted here)
// plus the tab strip for switching to the exercise library. The actual
// routines-list implementation lives in app/routines/RoutinesPageContent.tsx
// alongside its helper components (RoutineCard, RoutineSection, etc.) so
// the detail routes under /routines/[id]/* can still import those helpers.
// /routines as a top-level URL now redirects here.
export default async function LogPage(props: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const searchParams = await Promise.resolve(props.searchParams ?? {});
  const view = (getParam(searchParams, "view") ?? "routines").toLowerCase();

  if (view === "exercises") {
    // The exercise library has its own home at /exercises (no /progress
    // hop). The tab strip exposes it as a destination; clicking forwards
    // the user there.
    redirect("/exercises");
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <LogTabs current={view} />
      {view === "history" ? (
        <LogHistory />
      ) : (
        <RoutinesPageContent searchParams={Promise.resolve(searchParams)} />
      )}
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
      key: "history",
      label: "History",
      href: "/log?view=history",
      description: "Past sessions",
    },
    {
      key: "exercises",
      label: "Exercises",
      href: "/log?view=exercises",
      description: "Exercise library",
    },
  ];

  return (
    <nav aria-label="Log views" className="logTabStrip">
      {tabs.map((tab) => {
        const active = current === tab.key;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className="logTab"
            style={{
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
