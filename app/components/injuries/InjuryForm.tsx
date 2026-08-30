"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import BodyMap from "@/app/components/body-map/BodyMap";
import type { InjuryStatus } from "@/generated/prisma";
import type { ZoneState } from "@/app/components/body-map/types";
import type { InjuryInput } from "@/app/injuries/actions";
import { todayAppYmd } from "@/lib/dates";
import FactorSearchField from "./FactorSearchField";

type ZoneOption = { slug: string; label: string };

type InitialInjury = {
  id?: string;
  name: string;
  severity: number;
  status: InjuryStatus;
  startedAt: string;
  resolvedAt?: string | null;
  notes?: string | null;
  zoneSlugs: string[];
  aggravatingFactors?: string[];
};

export default function InjuryForm({
  zones,
  initial,
  submitLabel,
  action,
  factorSuggestions = [],
}: {
  zones: ZoneOption[];
  initial?: InitialInjury;
  submitLabel: string;
  action: (data: InjuryInput) => Promise<string | void>;
  factorSuggestions?: string[];
}) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [severity, setSeverity] = useState(initial?.severity ?? 2);
  const [status, setStatus] = useState<InjuryStatus>(initial?.status ?? "ACTIVE");
  const [startedAt, setStartedAt] = useState(initial?.startedAt ?? todayAppYmd());
  const [resolvedAt, setResolvedAt] = useState(initial?.resolvedAt ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [aggravatingFactors, setAggravatingFactors] = useState<string[]>(initial?.aggravatingFactors ?? []);
  const [selected, setSelected] = useState<string[]>(initial?.zoneSlugs ?? []);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const mapZones: ZoneState[] = zones.map((zone) => ({
    slug: zone.slug,
    freshness: selectedSet.has(zone.slug) ? "INJURED" : "FRESH",
  }));

  function submit() {
    startTransition(async () => {
      try {
        const id = await action({
          name,
          severity,
          status,
          startedAt,
          resolvedAt: resolvedAt || null,
          notes,
          zoneSlugs: selected,
          aggravatingFactors,
        });
        router.push(id ? `/injuries/${id}` : "/profile/health");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to save injury.");
      }
    });
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={formGrid}>
        <label style={field}>
          Name
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Left proximal hamstring tendinopathy" />
        </label>
        <label style={field}>
          Status
          <select value={status} onChange={(event) => setStatus(event.target.value as InjuryStatus)}>
            <option value="ACTIVE">Active</option>
            <option value="RECOVERING">Recovering</option>
            <option value="RESOLVED">Resolved</option>
            <option value="FLARED">Flared</option>
          </select>
        </label>
        <label style={field}>
          Severity: {severity}
          <input type="range" min={1} max={5} value={severity} onChange={(event) => setSeverity(Number(event.target.value))} />
          <span style={hint}>1 minor · 3 changing behavior · 5 minimal activity possible</span>
        </label>
        <label style={field}>
          Started at
          <input type="date" value={startedAt} onChange={(event) => setStartedAt(event.target.value)} />
        </label>
        {status === "RESOLVED" ? (
          <label style={field}>
            Resolved at
            <input type="date" value={resolvedAt} onChange={(event) => setResolvedAt(event.target.value)} />
          </label>
        ) : null}
      </div>

      <div style={field}>
        Aggravating factors
        <FactorSearchField value={aggravatingFactors} onChange={setAggravatingFactors} suggestions={factorSuggestions} />
        <span style={hint}>What makes it worse — search a movement/exercise, or type your own and press enter.</span>
      </div>

      <label style={field}>
        Notes
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} />
      </label>

      <section style={card}>
        <div style={{ fontWeight: 900 }}>Affected zones</div>
        <BodyMap
          zones={mapZones}
          selectable
          selectedSlugs={selected}
          onZoneClick={(slug) => setSelected((current) => (current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug]))}
          size="lg"
        />
      </section>

      {message ? <div style={hint}>{message}</div> : null}
      <button type="button" onClick={submit} disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </button>
    </div>
  );
}

const formGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

const field: React.CSSProperties = {
  display: "grid",
  gap: 6,
  fontSize: 13,
  fontWeight: 800,
};

const hint: React.CSSProperties = {
  fontSize: 12,
  color: "rgba(255,255,255,0.64)",
  fontWeight: 500,
};

const card: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 16,
  background: "rgba(255,255,255,0.04)",
  padding: 14,
  display: "grid",
  gap: 12,
};
