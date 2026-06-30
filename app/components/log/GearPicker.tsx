"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { listGearForActivity } from "@/app/log/gear-actions";
import type { GearPick, SavedGear } from "@/lib/gear-pick-types";
import { gearTypeMeta, gearTypesForActivity, resolveGearTypeSlug } from "@/lib/gear-types";
import { inputStyle } from "@/app/routines/[id]/log/form-ui";

// Select-or-create gear picker. Tap a saved item to add it, or "+ Add gear" to
// type a new one (type / name / weight). New gear is saved to your inventory on
// log save and reused next time. Controlled — the parent owns the value array.

const GRAMS_PER_OZ = 28.349523125;

function rid(): string {
  return Math.random().toString(36).slice(2);
}
function norm(s: string): string {
  return s.trim().toLowerCase();
}
function ozFromGrams(g: number | null): string {
  return g != null ? String(Math.round((g / GRAMS_PER_OZ) * 10) / 10) : "";
}

export default function GearPicker({
  activitySlug,
  value,
  onChange,
  showWeight = true,
  showConsumable = true,
  showQuantity = true,
}: {
  activitySlug: string;
  value: GearPick[];
  onChange: (next: GearPick[]) => void;
  showWeight?: boolean;
  showConsumable?: boolean;
  showQuantity?: boolean;
}) {
  const [saved, setSaved] = useState<SavedGear[]>([]);
  useEffect(() => {
    let cancelled = false;
    listGearForActivity(activitySlug)
      .then((rows) => {
        if (!cancelled) setSaved(rows);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activitySlug]);

  const listId = `gear-types-${activitySlug}`;
  const presets = useMemo(() => gearTypesForActivity(activitySlug), [activitySlug]);

  // Saved gear not already on this log — by id or by name.
  const pickedKeys = useMemo(() => {
    const ids = new Set(value.map((p) => p.gearId).filter(Boolean) as string[]);
    const names = new Set(value.map((p) => norm(p.name)).filter(Boolean));
    return { ids, names };
  }, [value]);
  const quickAdd = saved.filter((g) => !pickedKeys.ids.has(g.id) && !pickedKeys.names.has(norm(g.name)));

  function addSaved(g: SavedGear) {
    onChange([
      ...value,
      // Seed the type box with the friendly label, not the raw slug.
      { localId: rid(), gearId: g.id, type: gearTypeMeta(g.type).label, name: g.name, weightOz: ozFromGrams(g.weightGrams), quantity: "1", consumable: g.consumable },
    ]);
  }
  function addBlank() {
    onChange([...value, { localId: rid(), gearId: null, type: "", name: "", weightOz: "", quantity: "1", consumable: false }]);
  }
  function setPick(localId: string, patch: Partial<GearPick>) {
    onChange(value.map((p) => (p.localId === localId ? { ...p, ...patch, gearId: patch.gearId ?? p.gearId } : p)));
  }
  // Editing name/type breaks the link to the saved item so a renamed line
  // resolves fresh on save (never silently mutates inventory).
  function editIdentity(localId: string, patch: Partial<GearPick>) {
    onChange(value.map((p) => (p.localId === localId ? { ...p, ...patch, gearId: null } : p)));
  }
  function removePick(localId: string) {
    onChange(value.filter((p) => p.localId !== localId));
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {quickAdd.length > 0 ? (
        <div>
          <div style={quickLabel}>Your gear · tap to add</div>
          <div style={chipWrap}>
            {quickAdd.map((g) => (
              <button key={g.id} type="button" style={chip} onClick={() => addSaved(g)}>
                <span aria-hidden>{gearTypeMeta(g.type).icon}</span>
                <span style={chipName}>{g.name}</span>
                {g.weightGrams != null ? <span style={chipWeight}>{ozFromGrams(g.weightGrams)} oz</span> : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {value.map((p) => {
        const meta = gearTypeMeta(resolveGearTypeSlug(p.type));
        return (
          <div key={p.localId} style={gearCard}>
            <div style={cardTop}>
              <span aria-hidden style={typeIcon}>{p.type.trim() ? meta.icon : "📦"}</span>
              <input
                list={listId}
                style={{ ...inputStyle, flex: 1, minWidth: 0 }}
                value={p.type}
                onChange={(e) => editIdentity(p.localId, { type: e.target.value })}
                placeholder="Type — footwear, tent…"
                aria-label="Gear type"
              />
              <button type="button" style={removeBtn} onClick={() => removePick(p.localId)} aria-label="Remove gear">
                ✕
              </button>
            </div>
            <div style={fieldGrid(showWeight, showQuantity)}>
              <label style={field}>
                <span style={fieldLabel}>Name</span>
                <input
                  style={inputStyle}
                  value={p.name}
                  onChange={(e) => editIdentity(p.localId, { name: e.target.value })}
                  placeholder="e.g. Brooks Ghost 16"
                />
              </label>
              {showWeight ? (
                <label style={field}>
                  <span style={fieldLabel}>Weight (oz)</span>
                  <input
                    inputMode="decimal"
                    style={inputStyle}
                    value={p.weightOz}
                    onChange={(e) => setPick(p.localId, { weightOz: e.target.value })}
                    placeholder="oz"
                  />
                </label>
              ) : null}
              {showQuantity ? (
                <label style={field}>
                  <span style={fieldLabel}>Qty</span>
                  <input
                    inputMode="numeric"
                    style={{ ...inputStyle, textAlign: "center" }}
                    value={p.quantity}
                    onChange={(e) => setPick(p.localId, { quantity: e.target.value })}
                    placeholder="1"
                  />
                </label>
              ) : null}
            </div>
            {showConsumable ? (
              <button
                type="button"
                onClick={() => setPick(p.localId, { consumable: !p.consumable })}
                style={p.consumable ? consumableOn : consumableOff}
                title="Consumable (food/fuel/water) — excluded from base weight"
              >
                🍫 Consumable {p.consumable ? "· on" : ""}
              </button>
            ) : null}
          </div>
        );
      })}

      <button type="button" style={addBtn} onClick={addBlank}>
        + Add gear
      </button>

      <datalist id={listId}>
        {presets.map((t) => (
          <option key={t.value} value={t.label} />
        ))}
      </datalist>
    </div>
  );
}

const quickLabel: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0.4,
  textTransform: "uppercase",
  opacity: 0.6,
  marginBottom: 6,
};
const chipWrap: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 6 };
const chip: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid rgba(132,204,120,0.32)",
  background: "rgba(132,204,120,0.10)",
  color: "inherit",
  fontSize: 12.5,
  fontWeight: 700,
  cursor: "pointer",
  maxWidth: "100%",
};
const chipName: CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 };
const chipWeight: CSSProperties = { opacity: 0.6, fontWeight: 800, fontSize: 11 };

const gearCard: CSSProperties = {
  border: "1px solid rgba(128,128,128,0.32)",
  borderRadius: 12,
  padding: 12,
  background: "rgba(128,128,128,0.05)",
  display: "grid",
  gap: 10,
};
const cardTop: CSSProperties = { display: "flex", alignItems: "center", gap: 8 };
const typeIcon: CSSProperties = { fontSize: 18, flexShrink: 0, width: 24, textAlign: "center" };
function fieldGrid(showWeight: boolean, showQuantity: boolean): CSSProperties {
  const cols = ["minmax(0,1fr)"];
  if (showWeight) cols.push("90px");
  if (showQuantity) cols.push("72px");
  return { display: "grid", gridTemplateColumns: cols.join(" "), gap: 8 };
}
const field: CSSProperties = { display: "grid", gap: 4, minWidth: 0 };
const fieldLabel: CSSProperties = { fontSize: 11, fontWeight: 700, opacity: 0.72 };
const removeBtn: CSSProperties = {
  width: 34,
  height: 34,
  minHeight: 34,
  flexShrink: 0,
  borderRadius: 8,
  border: "1px solid rgba(248,113,113,0.3)",
  background: "rgba(248,113,113,0.08)",
  color: "rgba(248,160,160,0.95)",
  fontWeight: 900,
  cursor: "pointer",
};
const consumableBase: CSSProperties = {
  justifySelf: "start",
  padding: "6px 12px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
};
const consumableOff: CSSProperties = {
  ...consumableBase,
  border: "1px solid rgba(128,128,128,0.4)",
  background: "rgba(128,128,128,0.08)",
  color: "inherit",
  opacity: 0.6,
};
const consumableOn: CSSProperties = {
  ...consumableBase,
  border: "1px solid rgba(251,191,36,0.5)",
  background: "rgba(251,191,36,0.16)",
  color: "rgba(253,224,140,0.98)",
  opacity: 1,
};
const addBtn: CSSProperties = {
  padding: "10px 12px",
  border: "1px dashed rgba(128,128,128,0.6)",
  borderRadius: 12,
  background: "rgba(128,128,128,0.08)",
  color: "inherit",
  fontWeight: 800,
  fontSize: 14,
  cursor: "pointer",
  width: "100%",
};
