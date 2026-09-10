// Preset picker. Applying one writes real, fully editable rows — a preset is a
// starting point, not a template the progression stays bound to.

import Link from "next/link";
import PresetPicker from "./PresetPicker";
import { page, topBar, backLink, title, subtitle } from "../ui";

export const dynamic = "force-dynamic";

export default function NewProgressionPage() {
  return (
    <main style={page}>
      <div style={topBar}>
        <Link href="/progressions" style={backLink}>← Progressions</Link>
      </div>

      <header style={{ display: "grid", gap: 6 }}>
        <h1 style={title}>Start a progression</h1>
        <p style={subtitle}>
          Build your own, or start from a ladder below. Either way every step is
          editable afterward — rename them, reorder them, or throw them out.
        </p>
      </header>

      <PresetPicker />
    </main>
  );
}
