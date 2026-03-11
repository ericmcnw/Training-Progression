"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type ExerciseOption = {
  id: string;
  name: string;
};

export default function ExerciseSearch({
  exercises,
  initialQuery,
  selectedExerciseId,
}: {
  exercises: ExerciseOption[];
  initialQuery?: string;
  selectedExerciseId?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery ?? "");
  const [selectedId, setSelectedId] = useState(selectedExerciseId ?? "");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return exercises;
    return exercises.filter((ex) => ex.name.toLowerCase().includes(q));
  }, [exercises, query]);

  const activeId = filtered.find((ex) => ex.id === selectedId)?.id ?? filtered[0]?.id ?? "";

  function submit() {
    const next = new URLSearchParams(searchParams?.toString() ?? "");
    if (query.trim()) next.set("exercise", query.trim());
    else next.delete("exercise");

    if (activeId) next.set("exerciseId", activeId);
    else next.delete("exerciseId");

    router.push(`/progress?${next.toString()}`);
  }

  return (
    <div className="mobileProgressSearch" style={{ display: "grid", gap: 6, minWidth: 0 }}>
      <label style={{ fontSize: 12, opacity: 0.8, fontWeight: 800 }}>Exercise Search</label>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search exercise..."
      />

      <div className="mobileProgressSearchRow" style={{ display: "flex", gap: 8 }}>
        <select
          value={activeId}
          onChange={(e) => setSelectedId(e.target.value)}
          style={{ flex: 1, background: "#111b2e", color: "rgba(255,255,255,0.92)" }}
        >
          <option value="">Select exercise</option>
          {filtered.length === 0 && <option value="">No matches</option>}
          {filtered.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.name}
            </option>
          ))}
        </select>

        <button type="button" className="mobileProgressSearchButton" onClick={submit}>
          Show Charts
        </button>
      </div>
    </div>
  );
}
