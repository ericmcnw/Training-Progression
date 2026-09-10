// Progressions index. A progression is a ladder that outlives any one program
// — "Front lever", "Return to jumping" — so this is its own front door rather
// than a section inside a program.

import Link from "next/link";
import { getProgressions } from "./data";
import {
  page, topBar, backLink, ctaLink, title, subtitle,
  card, cardGrid, cardTitle, nowLine, nowTag, countTag,
  emptyCard, RungDots, rungText,
} from "./ui";

export const dynamic = "force-dynamic";

export default async function ProgressionsPage() {
  const progressions = await getProgressions();

  return (
    <main style={page}>
      <div style={topBar}>
        <Link href="/plan" style={backLink}>← Plan</Link>
        {progressions.length > 0 ? (
          <Link href="/progressions/new" style={ctaLink}>+ New progression</Link>
        ) : null}
      </div>

      <header style={{ display: "grid", gap: 6 }}>
        <h1 style={title}>Progressions</h1>
        <p style={subtitle}>
          The ladders you&apos;re climbing. Each one keeps its place across seasons and
          programs — tick a step when you own it.
        </p>
      </header>

      {progressions.length === 0 ? (
        <div style={emptyCard}>
          <div style={{ fontSize: 15, fontWeight: 900 }}>No progressions yet</div>
          <p style={{ ...subtitle, margin: 0 }}>
            Start from a preset — front lever, pull-up from zero, return to jumping —
            and edit it to fit. Nothing here is tied to a program.
          </p>
          <Link href="/progressions/new" style={ctaLink}>Add your first progression</Link>
        </div>
      ) : (
        <div style={cardGrid}>
          {progressions.map((p) => (
            <Link key={p.id} href={`/progressions/${p.id}`} style={card}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between" }}>
                <span style={cardTitle}>{p.name}</span>
                <RungDots total={p.total} done={p.done} />
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, justifyContent: "space-between" }}>
                <span style={nowLine}>
                  {p.current ? (
                    <>
                      <span style={nowTag}>now</span>
                      {rungText(p.current.label, p.current.modifier, p.current.targetText)}
                    </>
                  ) : p.total === 0 ? (
                    "No steps yet"
                  ) : (
                    "Every step done"
                  )}
                </span>
                <span style={countTag}>{p.done} of {p.total}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
