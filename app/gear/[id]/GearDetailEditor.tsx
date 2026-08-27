"use client";

import { useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ACTIVITY_REGISTRY } from "@/lib/activity-families";
import { GEAR_TYPES, gearTypeMeta, isWornGearType, resolveGearTypeSlug } from "@/lib/gear-types";
import { inputStyle } from "@/app/routines/[id]/log/form-ui";
import type { GearUsage } from "@/lib/gear-usage";
import { deleteGear, retireGear, unretireGear, updateGear } from "../actions";

const GRAMS_PER_OZ = 28.349523125;
const ACTIVITY_OPTIONS = ACTIVITY_REGISTRY.filter((a) => !a.pinnedCatchAll).sort((a, b) => a.label.localeCompare(b.label));

function ozFromGrams(g: number | null): string {
  return g != null ? String(Math.round((g / GRAMS_PER_OZ) * 10) / 10) : "";
}
function fmtUsageValue(u: GearUsage): string {
  const n = u.value;
  if (u.unit === "miles") return `${n.toFixed(n >= 100 ? 0 : 1)} mi`;
  if (u.unit === "nights") return `${n} night${n === 1 ? "" : "s"}`;
  if (u.unit === "days") return `${n} day${n === 1 ? "" : "s"}`;
  return `${n} session${n === 1 ? "" : "s"}`;
}
function fmtDate(ymd: string | null): string | null {
  if (!ymd) return null;
  return new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export default function GearDetailEditor({
  id,
  name: initialName,
  type: initialType,
  weightGrams,
  activitySlug: initialActivity,
  consumable: initialConsumable,
  worn: initialWorn,
  retired,
  usage,
}: {
  id: string;
  name: string;
  type: string;
  weightGrams: number | null;
  activitySlug: string | null;
  consumable: boolean;
  worn: boolean | null;
  retired: boolean;
  usage: GearUsage | null;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [name, setName] = useState(initialName);
  const [type, setType] = useState(gearTypeMeta(initialType).label);
  const [weightOz, setWeightOz] = useState(ozFromGrams(weightGrams));
  const [activitySlug, setActivitySlug] = useState(initialActivity ?? "");
  const [consumable, setConsumable] = useState(initialConsumable);
  // null on the row means "no opinion" — show what the gear type would decide,
  // and store an explicit answer the moment the user disagrees with it.
  const [worn, setWorn] = useState(initialWorn ?? isWornGearType(initialType));
  const [confirmDelete, setConfirmDelete] = useState(false);

  const meta = gearTypeMeta(resolveGearTypeSlug(type));

  function run(fn: () => Promise<unknown>) {
    startTransition(async () => {
      await fn();
      router.refresh();
    });
  }

  return (
    <div style={page}>
      <Link href="/gear" style={backLink}>
        ← Gear
      </Link>

      <header style={headerRow}>
        <span aria-hidden style={bigIcon}>
          {meta.icon}
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={eyebrow}>{meta.label}{retired ? " · retired" : ""}</div>
          <h1 style={title}>{name || "Gear"}</h1>
        </div>
      </header>

      {/* Usage */}
      {usage && usage.sessions > 0 ? (
        <div style={usageCard}>
          <div style={usageMain}>
            <div style={usageValue}>{fmtUsageValue(usage)}</div>
            <div style={usageSub}>lifetime</div>
          </div>
          <div style={usageStats}>
            <Stat label="Uses" value={String(usage.sessions)} />
            {usage.miles > 0 && usage.unit !== "miles" ? <Stat label="Miles" value={usage.miles.toFixed(1)} /> : null}
            {usage.nights > 0 && usage.unit !== "nights" ? <Stat label="Nights" value={String(usage.nights)} /> : null}
            <Stat label="First" value={fmtDate(usage.firstUsed) ?? "—"} />
            <Stat label="Last" value={fmtDate(usage.lastUsed) ?? "—"} />
          </div>
        </div>
      ) : (
        <div style={noUsage}>No logged use yet. It’ll rack up miles/nights/sessions as you pick it on logs.</div>
      )}

      {/* Edit fields */}
      <div style={{ display: "grid", gap: 12 }}>
        <label style={fieldBlock}>
          <span style={fieldLabel}>Name</span>
          <input
            style={inputStyle}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() !== initialName && run(() => updateGear(id, { name }))}
            placeholder="e.g. Altra Lone Peak 9+"
          />
        </label>

        <label style={fieldBlock}>
          <span style={fieldLabel}>Type</span>
          <input
            list="gear-detail-types"
            style={inputStyle}
            value={type}
            onChange={(e) => setType(e.target.value)}
            onBlur={() => resolveGearTypeSlug(type) !== initialType && run(() => updateGear(id, { type }))}
            placeholder="footwear, tent, pack…"
          />
          <datalist id="gear-detail-types">
            {GEAR_TYPES.map((t) => (
              <option key={t.value} value={t.label} />
            ))}
          </datalist>
        </label>

        <label style={fieldBlock}>
          <span style={fieldLabel}>Weight (oz)</span>
          <input
            inputMode="decimal"
            style={inputStyle}
            value={weightOz}
            onChange={(e) => setWeightOz(e.target.value)}
            onBlur={() => weightOz.trim() !== ozFromGrams(weightGrams) && run(() => updateGear(id, { weightOz }))}
            placeholder="oz — leave blank if you don’t weigh it"
          />
        </label>

        <label style={fieldBlock}>
          <span style={fieldLabel}>Shows on logs for</span>
          <select
            style={inputStyle}
            value={activitySlug}
            onChange={(e) => {
              setActivitySlug(e.target.value);
              run(() => updateGear(id, { activitySlug: e.target.value || null }));
            }}
          >
            <option value="">Everywhere (any activity)</option>
            {ACTIVITY_OPTIONS.map((a) => (
              <option key={a.slug} value={a.slug}>
                {a.icon} {a.label}
              </option>
            ))}
          </select>
          <span style={fieldHint}>“Everywhere” suits footwear/watches; scope packs, tents, boards to their sport.</span>
        </label>

        <button
          type="button"
          onClick={() => {
            const next = !worn;
            setWorn(next);
            run(() => updateGear(id, { worn: next }));
          }}
          style={worn ? consumableOn : consumableOff}
          title="Worn on you rather than carried — excluded from a log's carried load"
        >
          {worn ? "🧍 Worn" : "🎒 Carried"}
        </button>

        <button
          type="button"
          onClick={() => {
            const next = !consumable;
            setConsumable(next);
            run(() => updateGear(id, { consumable: next }));
          }}
          style={consumable ? consumableOn : consumableOff}
          title="Consumable (food/fuel/water) — excluded from base weight"
        >
          🍫 Consumable {consumable ? "· on" : ""}
        </button>
      </div>

      {/* Lifecycle */}
      <div style={lifecycle}>
        {retired ? (
          <button type="button" style={retireBtn} onClick={() => run(() => unretireGear(id))}>
            ♻ Un-retire — put back in rotation
          </button>
        ) : (
          <button type="button" style={retireBtn} onClick={() => run(() => retireGear(id))}>
            🗄 Retire — keep history, hide from pickers
          </button>
        )}

        {confirmDelete ? (
          <div style={confirmBox}>
            <span style={{ fontSize: 12.5, opacity: 0.85 }}>Delete permanently? Usage history is lost — retire keeps it.</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" style={cancelBtn} onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
              <button
                type="button"
                style={deleteConfirmBtn}
                onClick={() => run(async () => { await deleteGear(id); router.push("/gear"); })}
              >
                Delete
              </button>
            </div>
          </div>
        ) : (
          <button type="button" style={deleteLink} onClick={() => setConfirmDelete(true)}>
            Delete gear
          </button>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={statValue}>{value}</div>
      <div style={statLabel}>{label}</div>
    </div>
  );
}

// ── styles ──
const page: CSSProperties = { maxWidth: 640, margin: "0 auto", padding: "16px 14px 60px", display: "grid", gap: 16 };
const backLink: CSSProperties = { fontSize: 13, fontWeight: 800, color: "rgba(147,197,253,0.9)", textDecoration: "none", justifySelf: "start" };
const headerRow: CSSProperties = { display: "flex", alignItems: "center", gap: 12 };
const bigIcon: CSSProperties = { fontSize: 34, flexShrink: 0, width: 44, textAlign: "center" };
const eyebrow: CSSProperties = { fontSize: 11, fontWeight: 900, letterSpacing: 0.5, textTransform: "uppercase", opacity: 0.55 };
const title: CSSProperties = { margin: "2px 0 0", fontSize: 24, fontWeight: 900, letterSpacing: -0.4, overflow: "hidden", textOverflow: "ellipsis" };
const usageCard: CSSProperties = {
  display: "grid",
  gap: 12,
  padding: 16,
  borderRadius: 14,
  border: "1px solid rgba(132,204,120,0.28)",
  background: "linear-gradient(180deg, rgba(132,204,120,0.10), rgba(132,204,120,0.03))",
};
const usageMain: CSSProperties = { display: "flex", alignItems: "baseline", gap: 8 };
const usageValue: CSSProperties = { fontWeight: 900, fontSize: 26, letterSpacing: -0.5 };
const usageSub: CSSProperties = { fontSize: 12, fontWeight: 700, opacity: 0.6 };
const usageStats: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 16 };
const statValue: CSSProperties = { fontWeight: 800, fontSize: 13.5 };
const statLabel: CSSProperties = { fontSize: 10.5, fontWeight: 700, opacity: 0.55, textTransform: "uppercase", letterSpacing: 0.4 };
const noUsage: CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px dashed rgba(255,255,255,0.12)",
  fontSize: 12.5,
  opacity: 0.7,
  lineHeight: 1.5,
};
const fieldBlock: CSSProperties = { display: "grid", gap: 5 };
const fieldLabel: CSSProperties = { fontSize: 12, fontWeight: 800, opacity: 0.8 };
const fieldHint: CSSProperties = { fontSize: 11, fontWeight: 600, opacity: 0.5, lineHeight: 1.4 };
const consumableBase: CSSProperties = { justifySelf: "start", padding: "8px 14px", borderRadius: 999, fontSize: 12.5, fontWeight: 800, cursor: "pointer", minHeight: 40 };
const consumableOff: CSSProperties = { ...consumableBase, border: "1px solid rgba(128,128,128,0.4)", background: "rgba(128,128,128,0.08)", color: "inherit", opacity: 0.65 };
const consumableOn: CSSProperties = { ...consumableBase, border: "1px solid rgba(251,191,36,0.5)", background: "rgba(251,191,36,0.16)", color: "rgba(253,224,140,0.98)" };
const lifecycle: CSSProperties = { display: "grid", gap: 10, marginTop: 4, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.08)" };
const retireBtn: CSSProperties = {
  padding: "11px 14px",
  borderRadius: 12,
  border: "1px solid rgba(128,128,128,0.4)",
  background: "rgba(128,128,128,0.08)",
  color: "inherit",
  fontWeight: 800,
  fontSize: 13.5,
  cursor: "pointer",
  minHeight: 44,
};
const deleteLink: CSSProperties = { justifySelf: "start", padding: "6px 2px", background: "none", border: "none", color: "rgba(248,140,140,0.85)", fontSize: 12.5, fontWeight: 800, cursor: "pointer" };
const confirmBox: CSSProperties = {
  display: "grid",
  gap: 10,
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(248,113,113,0.35)",
  background: "rgba(248,113,113,0.06)",
};
const cancelBtn: CSSProperties = { padding: "8px 14px", borderRadius: 10, border: "1px solid rgba(128,128,128,0.4)", background: "transparent", color: "inherit", fontWeight: 700, fontSize: 13, cursor: "pointer" };
const deleteConfirmBtn: CSSProperties = { padding: "8px 16px", borderRadius: 10, border: "1px solid rgba(248,113,113,0.5)", background: "rgba(248,113,113,0.18)", color: "rgba(252,180,180,0.98)", fontWeight: 800, fontSize: 13, cursor: "pointer" };
