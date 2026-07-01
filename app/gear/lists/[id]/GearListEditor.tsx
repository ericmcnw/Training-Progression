"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ACTIVITY_REGISTRY } from "@/lib/activity-families";
import { gearTypeMeta } from "@/lib/gear-types";
import { inputStyle, textareaStyle } from "@/app/routines/[id]/log/form-ui";
import type { GearListItemRow } from "@/lib/gear-lists";
import {
  addGearListItemAdHoc,
  addGearListItemFromGear,
  deleteGearList,
  removeGearListItem,
  renameGearList,
  reorderGearListItems,
  updateGearListItem,
} from "../actions";

const GRAMS_PER_OZ = 28.349523125;
const GRAMS_PER_LB = 453.59237;

type AvailableGear = { id: string; type: string; name: string; weightGrams: number | null };

function fmtWeight(grams: number): string {
  if (grams <= 0) return "0 lb";
  if (grams < GRAMS_PER_LB) return `${Math.round(grams / GRAMS_PER_OZ)} oz`;
  return `${(grams / GRAMS_PER_LB).toFixed(1)} lb`;
}
function ozFromGrams(g: number | null): string {
  return g != null ? String(Math.round((g / GRAMS_PER_OZ) * 10) / 10) : "";
}

const ACTIVITY_OPTIONS = ACTIVITY_REGISTRY.filter((a) => !a.pinnedCatchAll).sort((a, b) => a.label.localeCompare(b.label));

export default function GearListEditor({
  listId,
  name: initialName,
  activitySlug: initialActivity,
  notes: initialNotes,
  items: initialItems,
  availableGear,
}: {
  listId: string;
  name: string;
  activitySlug: string | null;
  notes: string | null;
  items: GearListItemRow[];
  availableGear: AvailableGear[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [name, setName] = useState(initialName);
  const [activitySlug, setActivitySlug] = useState(initialActivity ?? "");
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [items, setItems] = useState(initialItems);
  useEffect(() => setItems(initialItems), [initialItems]);

  const [showGear, setShowGear] = useState(false);
  const [adhocOpen, setAdhocOpen] = useState(false);

  function run(fn: () => Promise<unknown>) {
    startTransition(async () => {
      await fn();
      router.refresh();
    });
  }

  // Weight + progress totals.
  const totals = useMemo(() => {
    let all = 0;
    let checked = 0;
    let base = 0; // checked, non-consumable
    let checkedCount = 0;
    let hasConsumable = false;
    for (const it of items) {
      const g = (it.weightGrams ?? 0) * it.quantity;
      all += g;
      if (it.consumable) hasConsumable = true;
      if (it.checked) {
        checked += g;
        checkedCount += 1;
        if (!it.consumable) base += g;
      }
    }
    return { all, checked, base, checkedCount, hasConsumable };
  }, [items]);

  const addedGearIds = useMemo(() => new Set(items.map((i) => i.gearId).filter(Boolean) as string[]), [items]);
  const gearToOffer = availableGear.filter((g) => !addedGearIds.has(g.id));

  // ── Item mutations (optimistic, then reconcile) ──
  function toggleChecked(it: GearListItemRow) {
    const next = !it.checked;
    setItems((prev) => prev.map((p) => (p.id === it.id ? { ...p, checked: next } : p)));
    run(() => updateGearListItem(it.id, { checked: next }));
  }
  function patchItem(it: GearListItemRow, patch: Partial<GearListItemRow>, weightOz?: string) {
    setItems((prev) => prev.map((p) => (p.id === it.id ? { ...p, ...patch } : p)));
    run(() =>
      updateGearListItem(it.id, {
        quantity: patch.quantity,
        label: patch.label,
        consumable: patch.consumable,
        weightOz,
      })
    );
  }
  function remove(it: GearListItemRow) {
    setItems((prev) => prev.filter((p) => p.id !== it.id));
    run(() => removeGearListItem(it.id));
  }
  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const next = items.slice();
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
    run(() => reorderGearListItems(listId, next.map((i) => i.id)));
  }

  function addFromGear(g: AvailableGear) {
    run(() => addGearListItemFromGear(listId, g.id));
  }

  return (
    <div style={page}>
      <Link href="/gear/lists" style={backLink}>
        ← All lists
      </Link>

      {/* Header */}
      <div style={{ display: "grid", gap: 10 }}>
        <input
          style={{ ...inputStyle, fontSize: 20, fontWeight: 900 }}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() !== initialName && run(() => renameGearList(listId, { name }))}
          placeholder="List name"
          aria-label="List name"
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
          <label style={fieldLabelBlock}>
            <span style={fieldLabel}>Activity</span>
            <select
              style={inputStyle}
              value={activitySlug}
              onChange={(e) => {
                setActivitySlug(e.target.value);
                run(() => renameGearList(listId, { activitySlug: e.target.value || null }));
              }}
            >
              <option value="">Any activity</option>
              {ACTIVITY_OPTIONS.map((a) => (
                <option key={a.slug} value={a.slug}>
                  {a.icon} {a.label}
                </option>
              ))}
            </select>
          </label>
          <label style={fieldLabelBlock}>
            <span style={fieldLabel}>Notes</span>
            <textarea
              style={{ ...textareaStyle, minHeight: 44 }}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => notes.trim() !== (initialNotes ?? "") && run(() => renameGearList(listId, { notes }))}
              placeholder="Optional — resupply notes, trip context…"
            />
          </label>
        </div>
      </div>

      {/* Progress + weight */}
      <div style={summaryCard}>
        <div>
          <div style={summaryBig}>
            {totals.checkedCount} / {items.length} packed
          </div>
          <div style={summarySub}>{items.length === 0 ? "Add gear to start your list" : "tap a box to pack / unpack"}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={summaryBig}>{fmtWeight(totals.checked)}</div>
          <div style={summarySub}>
            packing
            {totals.hasConsumable ? ` · ${fmtWeight(totals.base)} base` : ""}
          </div>
        </div>
      </div>

      {/* Items */}
      <div style={{ display: "grid", gap: 8 }}>
        {items.map((it, i) => {
          const meta = it.type ? gearTypeMeta(it.type) : null;
          return (
            <div key={it.id} style={{ ...itemRow, opacity: it.checked ? 1 : 0.55 }}>
              <button
                type="button"
                onClick={() => toggleChecked(it)}
                style={it.checked ? checkOn : checkOff}
                aria-label={it.checked ? "Packed — tap to unpack" : "Not packed — tap to pack"}
              >
                {it.checked ? "✓" : ""}
              </button>
              <span aria-hidden style={itemIcon}>
                {meta ? meta.icon : "📝"}
              </span>
              <div style={{ display: "grid", gap: 2, minWidth: 0, flex: 1 }}>
                <input
                  style={itemNameInput}
                  value={it.label}
                  onChange={(e) => setItems((prev) => prev.map((p) => (p.id === it.id ? { ...p, label: e.target.value } : p)))}
                  onBlur={(e) => e.target.value.trim() !== it.label && patchItem(it, { label: e.target.value })}
                  aria-label="Item name"
                />
                <div style={itemMeta}>
                  {meta ? meta.label : "Checklist item"}
                  {it.weightGrams != null ? ` · ${ozFromGrams(it.weightGrams)} oz` : ""}
                  {it.quantity > 1 ? ` · ×${it.quantity}` : ""}
                  {it.consumable ? " · consumable" : ""}
                </div>
              </div>
              <div style={itemControls}>
                <button type="button" style={miniBtn} onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                  ▲
                </button>
                <button
                  type="button"
                  style={miniBtn}
                  onClick={() => move(i, 1)}
                  disabled={i === items.length - 1}
                  aria-label="Move down"
                >
                  ▼
                </button>
                <button
                  type="button"
                  style={it.consumable ? consumableOn : miniBtn}
                  onClick={() => patchItem(it, { consumable: !it.consumable })}
                  title="Consumable (food/fuel/water) — excluded from base weight"
                  aria-label="Toggle consumable"
                >
                  🍫
                </button>
                <button type="button" style={removeBtn} onClick={() => remove(it)} aria-label="Remove item">
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add affordances */}
      <div style={{ display: "grid", gap: 8 }}>
        <button type="button" style={addBtn} onClick={() => setShowGear((v) => !v)}>
          ＋ From your gear
        </button>
        {showGear ? (
          gearToOffer.length > 0 ? (
            <div style={chipWrap}>
              {gearToOffer.map((g) => (
                <button key={g.id} type="button" style={chip} onClick={() => addFromGear(g)}>
                  <span aria-hidden>{gearTypeMeta(g.type).icon}</span>
                  <span style={chipName}>{g.name}</span>
                  {g.weightGrams != null ? <span style={chipWeight}>{ozFromGrams(g.weightGrams)} oz</span> : null}
                </button>
              ))}
            </div>
          ) : (
            <div style={emptyHint}>
              All your gear is on this list. Add gear from a log, or use “Add other” for non-inventory items.
            </div>
          )
        ) : null}

        <button type="button" style={addBtn} onClick={() => setAdhocOpen((v) => !v)}>
          ＋ Add other (non-inventory)
        </button>
        {adhocOpen ? <AdhocForm listId={listId} onDone={() => run(async () => {})} /> : null}
      </div>

      <button type="button" style={deleteLink} onClick={() => run(async () => { await deleteGearList(listId); router.push("/gear/lists"); })}>
        Delete list
      </button>
    </div>
  );
}

function AdhocForm({ listId, onDone }: { listId: string; onDone: () => void }) {
  const [label, setLabel] = useState("");
  const [weightOz, setWeightOz] = useState("");
  const [consumable, setConsumable] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const labelRef = useRef<HTMLInputElement>(null);

  function submit() {
    const l = label.trim();
    if (!l) return;
    startTransition(async () => {
      await addGearListItemAdHoc(listId, { label: l, weightOz, consumable });
      setLabel("");
      setWeightOz("");
      setConsumable(false);
      router.refresh();
      onDone();
      labelRef.current?.focus();
    });
  }

  return (
    <div style={adhocCard}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 90px", gap: 8 }}>
        <input
          ref={labelRef}
          style={inputStyle}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="e.g. Sunscreen, 2 L water, permit"
          aria-label="Item name"
        />
        <input
          inputMode="decimal"
          style={inputStyle}
          value={weightOz}
          onChange={(e) => setWeightOz(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="oz"
          aria-label="Weight in ounces"
        />
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
        <button
          type="button"
          onClick={() => setConsumable((v) => !v)}
          style={consumable ? consumableOn : consumableChip}
          title="Consumable (food/fuel/water) — excluded from base weight"
        >
          🍫 Consumable {consumable ? "· on" : ""}
        </button>
        <button type="button" style={addConfirm} onClick={submit}>
          Add item
        </button>
      </div>
    </div>
  );
}

// ── styles ──
const page: CSSProperties = { maxWidth: 720, margin: "0 auto", padding: "16px 14px 60px", display: "grid", gap: 16 };
const backLink: CSSProperties = { fontSize: 13, fontWeight: 800, color: "rgba(147,197,253,0.9)", textDecoration: "none", justifySelf: "start" };
const fieldLabelBlock: CSSProperties = { display: "grid", gap: 4 };
const fieldLabel: CSSProperties = { fontSize: 11, fontWeight: 700, opacity: 0.72 };
const summaryCard: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: "14px 16px",
  borderRadius: 14,
  border: "1px solid rgba(132,204,120,0.28)",
  background: "linear-gradient(180deg, rgba(132,204,120,0.10), rgba(132,204,120,0.03))",
};
const summaryBig: CSSProperties = { fontWeight: 900, fontSize: 18, letterSpacing: -0.3 };
const summarySub: CSSProperties = { fontSize: 11.5, fontWeight: 700, opacity: 0.6 };
const itemRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(128,128,128,0.28)",
  background: "rgba(128,128,128,0.05)",
};
const checkBase: CSSProperties = {
  width: 30,
  height: 30,
  minHeight: 30,
  flexShrink: 0,
  borderRadius: 8,
  fontWeight: 900,
  fontSize: 15,
  cursor: "pointer",
};
const checkOn: CSSProperties = {
  ...checkBase,
  border: "1px solid rgba(132,204,120,0.6)",
  background: "rgba(132,204,120,0.22)",
  color: "rgba(190,240,170,0.98)",
};
const checkOff: CSSProperties = {
  ...checkBase,
  border: "1px solid rgba(128,128,128,0.4)",
  background: "rgba(128,128,128,0.06)",
  color: "transparent",
};
const itemIcon: CSSProperties = { fontSize: 18, flexShrink: 0, width: 24, textAlign: "center" };
const itemNameInput: CSSProperties = {
  ...inputStyle,
  padding: "4px 6px",
  fontWeight: 800,
  border: "1px solid transparent",
  background: "transparent",
};
const itemMeta: CSSProperties = { fontSize: 11, fontWeight: 700, opacity: 0.55, paddingLeft: 6 };
const itemControls: CSSProperties = { display: "flex", gap: 4, flexShrink: 0 };
const miniBtn: CSSProperties = {
  width: 30,
  height: 30,
  minHeight: 30,
  borderRadius: 8,
  border: "1px solid rgba(128,128,128,0.32)",
  background: "rgba(128,128,128,0.06)",
  color: "inherit",
  fontWeight: 800,
  fontSize: 12,
  cursor: "pointer",
};
const consumableOn: CSSProperties = {
  ...miniBtn,
  width: "auto",
  padding: "0 10px",
  border: "1px solid rgba(251,191,36,0.5)",
  background: "rgba(251,191,36,0.16)",
  color: "rgba(253,224,140,0.98)",
};
const removeBtn: CSSProperties = {
  ...miniBtn,
  border: "1px solid rgba(248,113,113,0.3)",
  background: "rgba(248,113,113,0.08)",
  color: "rgba(248,160,160,0.95)",
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
const chipWrap: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 6 };
const chip: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid rgba(132,204,120,0.32)",
  background: "rgba(132,204,120,0.10)",
  color: "inherit",
  fontSize: 12.5,
  fontWeight: 700,
  cursor: "pointer",
  minHeight: 36,
};
const chipName: CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 };
const chipWeight: CSSProperties = { opacity: 0.6, fontWeight: 800, fontSize: 11 };
const emptyHint: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px dashed rgba(255,255,255,0.12)",
  fontSize: 12,
  opacity: 0.7,
  lineHeight: 1.5,
};
const adhocCard: CSSProperties = {
  display: "grid",
  gap: 10,
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(128,128,128,0.32)",
  background: "rgba(128,128,128,0.05)",
};
const consumableChip: CSSProperties = {
  padding: "6px 12px",
  borderRadius: 999,
  border: "1px solid rgba(128,128,128,0.4)",
  background: "rgba(128,128,128,0.08)",
  color: "inherit",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
  opacity: 0.7,
};
const addConfirm: CSSProperties = {
  padding: "8px 16px",
  borderRadius: 10,
  border: "1px solid rgba(132,204,120,0.5)",
  background: "rgba(132,204,120,0.18)",
  color: "rgba(190,240,170,0.98)",
  fontWeight: 800,
  fontSize: 13,
  cursor: "pointer",
};
const deleteLink: CSSProperties = {
  justifySelf: "start",
  marginTop: 8,
  padding: "8px 2px",
  background: "none",
  border: "none",
  color: "rgba(248,140,140,0.85)",
  fontSize: 12.5,
  fontWeight: 800,
  cursor: "pointer",
};
