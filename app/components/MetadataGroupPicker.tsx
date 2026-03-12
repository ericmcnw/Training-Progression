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
  inputName = "metadataGroupIds",
}: {
  title: string;
  help?: string;
  groups: GroupOption[];
  selectedIds?: string[];
  inputName?: string;
}) {
  const grouped = groups.reduce<Record<MetadataGroupKind, GroupOption[]>>((acc, group) => {
    if (!acc[group.kind]) acc[group.kind] = [];
    acc[group.kind].push(group);
    return acc;
  }, {} as Record<MetadataGroupKind, GroupOption[]>);

  const selected = new Set(selectedIds ?? []);
  const orderedKinds = Object.keys(grouped).sort() as MetadataGroupKind[];

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div>
        <label style={styles.label}>{title}</label>
        {help ? <div style={styles.help}>{help}</div> : null}
      </div>

      {orderedKinds.map((kind) => (
        <div key={kind} style={styles.kindBlock}>
          <div style={styles.kindTitle}>{formatMetadataGroupKind(kind)}</div>
          <div style={styles.grid}>
            {grouped[kind]
              .slice()
              .sort((a, b) => a.label.localeCompare(b.label))
              .map((group) => (
                <label key={group.id} style={styles.option}>
                  <input
                    type="checkbox"
                    name={inputName}
                    value={group.id}
                    defaultChecked={selected.has(group.id)}
                  />
                  <span>{group.label}</span>
                </label>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const styles = {
  label: { display: "block", fontWeight: 900 as const, marginBottom: 4 },
  help: { opacity: 0.72, fontSize: 12 },
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
