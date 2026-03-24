"use client";

import { formatMetadataGroupKind } from "@/lib/metadata";
import type { MetadataGroupKind } from "@/generated/prisma";

type GroupOption = {
  id: string;
  slug: string;
  label: string;
  kind: MetadataGroupKind;
};

export default function MetadataGroupPicker({
  title,
  help,
  groups,
  selectedIds,
  onSelectionChange,
  inputName = "metadataGroupIds",
  collapsible = false,
  defaultOpen = false,
}: {
  title: string;
  help?: string;
  groups: GroupOption[];
  selectedIds?: string[];
  onSelectionChange?: (nextSelectedIds: string[]) => void;
  inputName?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const grouped = groups.reduce<Record<MetadataGroupKind, GroupOption[]>>((acc, group) => {
    if (!acc[group.kind]) acc[group.kind] = [];
    acc[group.kind].push(group);
    return acc;
  }, {} as Record<MetadataGroupKind, GroupOption[]>);

  const selected = new Set(selectedIds ?? []);
  const orderedKinds = Object.keys(grouped).sort() as MetadataGroupKind[];
  const selectedGroups = groups
    .filter((group) => selected.has(group.id))
    .sort((a, b) => a.label.localeCompare(b.label));
  const summaryText =
    selectedGroups.length === 0
      ? "No groups selected"
      : selectedGroups.length <= 3
      ? selectedGroups.map((group) => group.label).join(", ")
      : `${selectedGroups.slice(0, 3).map((group) => group.label).join(", ")} +${selectedGroups.length - 3} more`;

  function handleCheckedChange(groupId: string, checked: boolean) {
    if (!onSelectionChange) return;
    const next = new Set(selectedIds ?? []);
    if (checked) next.add(groupId);
    else next.delete(groupId);
    onSelectionChange(Array.from(next));
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div>
        <label style={styles.label}>{title}</label>
        {help ? <div style={styles.help}>{help}</div> : null}
      </div>

      {collapsible ? (
        <details style={styles.details} open={defaultOpen || undefined}>
          <summary data-collapsible-summary style={styles.summary}>
            <span>Edit analysis groups</span>
            <span style={styles.summaryMeta}>
              {selectedGroups.length} selected
              <span style={styles.summaryDivider}>|</span>
              {summaryText}
            </span>
          </summary>
          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            {selectedGroups.length > 0 ? (
              <div style={styles.selectedRow}>
                {selectedGroups.map((group) => (
                  <span key={group.id} style={styles.chip}>
                    {group.label}
                  </span>
                ))}
              </div>
            ) : null}
            {orderedKinds.map((kind) => (
              <div key={kind} style={styles.kindBlock}>
                <div style={styles.kindTitle}>{formatMetadataGroupKind(kind)}</div>
                <div style={styles.grid}>
                  {grouped[kind]
                    .slice()
                    .sort((a, b) => a.label.localeCompare(b.label))
                    .map((group) => (
                      <label key={group.id} style={styles.option}>
                        {onSelectionChange ? (
                          <input
                            type="checkbox"
                            name={inputName}
                            value={group.id}
                            checked={selected.has(group.id)}
                            onChange={(event) => handleCheckedChange(group.id, event.target.checked)}
                          />
                        ) : (
                          <input
                            type="checkbox"
                            name={inputName}
                            value={group.id}
                            defaultChecked={selected.has(group.id)}
                          />
                        )}
                        <span>{group.label}</span>
                      </label>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </details>
      ) : (
        orderedKinds.map((kind) => (
          <div key={kind} style={styles.kindBlock}>
            <div style={styles.kindTitle}>{formatMetadataGroupKind(kind)}</div>
            <div style={styles.grid}>
              {grouped[kind]
                .slice()
                .sort((a, b) => a.label.localeCompare(b.label))
                .map((group) => (
                  <label key={group.id} style={styles.option}>
                    {onSelectionChange ? (
                      <input
                        type="checkbox"
                        name={inputName}
                        value={group.id}
                        checked={selected.has(group.id)}
                        onChange={(event) => handleCheckedChange(group.id, event.target.checked)}
                      />
                    ) : (
                      <input
                        type="checkbox"
                        name={inputName}
                        value={group.id}
                        defaultChecked={selected.has(group.id)}
                      />
                    )}
                    <span>{group.label}</span>
                  </label>
                ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

const styles = {
  label: { display: "block", fontWeight: 900 as const, marginBottom: 4 },
  help: { opacity: 0.72, fontSize: 12 },
  details: {
    border: "1px solid rgba(128,128,128,0.35)",
    borderRadius: 12,
    padding: "10px 12px",
    background: "rgba(128,128,128,0.04)",
  },
  summary: {
    cursor: "pointer",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap" as const,
    fontWeight: 900 as const,
  },
  summaryMeta: {
    fontSize: 12,
    opacity: 0.72,
    fontWeight: 600 as const,
  },
  summaryDivider: {
    display: "inline-block",
    margin: "0 6px",
    opacity: 0.5,
  },
  selectedRow: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap" as const,
  },
  chip: {
    border: "1px solid rgba(128,128,128,0.35)",
    borderRadius: 999,
    padding: "4px 8px",
    fontSize: 12,
    background: "rgba(128,128,128,0.08)",
  },
  kindBlock: {
    border: "1px solid rgba(128,128,128,0.35)",
    borderRadius: 10,
    padding: 10,
    background: "rgba(128,128,128,0.04)",
  },
  kindTitle: { fontSize: 12, fontWeight: 900 as const, opacity: 0.82, marginBottom: 8, textTransform: "uppercase" as const },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 },
  option: { display: "flex", gap: 8, alignItems: "center", fontSize: 14 },
};
