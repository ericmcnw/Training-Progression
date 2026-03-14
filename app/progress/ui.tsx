import Link from "next/link";
import type { ProgressRange, ProgressSection, ProgressTab } from "@/lib/progress-v2";
import { progressRanges, progressSections, progressTabDescription, progressTabs, rangeChipLabel } from "@/lib/progress-v2";

export function ProgressShell({
  section,
  title,
  subtitle,
  children,
  actions,
}: {
  section: ProgressSection;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div style={styles.container}>
      <div style={styles.topRow}>
        <div>
          <h1 style={styles.h1}>{title}</h1>
          {subtitle ? <div style={styles.sub}>{subtitle}</div> : null}
        </div>
        {actions ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{actions}</div> : null}
      </div>

      <PillNav
        items={progressSections().map((item) => ({ ...item, active: item.key === section }))}
      />

      <div style={{ marginTop: 18, display: "grid", gap: 16 }}>{children}</div>
    </div>
  );
}

export function TargetHeader({
  section,
  title,
  subtitle,
  basePath,
  tab,
  range,
}: {
  section: ProgressSection;
  title: string;
  subtitle?: string;
  basePath: string;
  tab: ProgressTab;
  range: ProgressRange;
}) {
  return (
    <div style={styles.container}>
      <div style={styles.topRow}>
        <div>
          <h1 style={styles.h1}>{title}</h1>
          {subtitle ? <div style={styles.sub}>{subtitle}</div> : null}
        </div>
      </div>
      <PillNav items={progressSections().map((item) => ({ ...item, active: item.key === section }))} />
      <div style={styles.overlayNav}>
        <PillNav items={progressTabs(basePath, range).map((item) => ({ ...item, active: item.key === tab }))} />
        <PillNav items={progressRanges(basePath, tab).map((item) => ({ ...item, active: item.key === range }))} />
      </div>
    </div>
  );
}

export function PillNav({
  items,
}: {
  items: Array<{ href: string; label: string; active?: boolean }>;
}) {
  return (
    <div style={styles.pillRow}>
      {items.map((item) => (
        <Link
          key={`${item.href}-${item.label}`}
          href={item.href}
          style={{
            ...styles.pill,
            ...(item.active ? styles.pillActive : null),
          }}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}

export function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={styles.section}>
      <div style={styles.sectionHeader}>{title}</div>
      <div style={{ padding: 12, display: "grid", gap: 10 }}>{children}</div>
    </section>
  );
}

export function TargetCard({
  href,
  title,
  subtitle,
  chips,
}: {
  href: string;
  title: string;
  subtitle?: string;
  chips?: string[];
}) {
  return (
    <Link href={href} style={styles.targetCard}>
      <div style={{ fontWeight: 900, fontSize: 16 }}>{title}</div>
      {subtitle ? <div style={{ marginTop: 4, fontSize: 13, opacity: 0.78 }}>{subtitle}</div> : null}
      {chips && chips.length > 0 ? (
        <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {chips.map((chip) => (
            <span key={chip} style={styles.chip}>
              {chip}
            </span>
          ))}
        </div>
      ) : null}
    </Link>
  );
}

export function StatGrid({
  items,
}: {
  items: Array<{ label: string; value: string }>;
}) {
  return (
    <div style={styles.statGrid}>
      {items.map((item) => (
        <div key={item.label} style={styles.statCard}>
          <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 800 }}>{item.label}</div>
          <div style={{ marginTop: 4, fontSize: 20, fontWeight: 900 }}>{item.value}</div>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <div style={{ opacity: 0.7, fontSize: 13 }}>{message}</div>;
}

export function TabHint({ tab }: { tab: ProgressTab }) {
  return <div style={styles.tabHint}>{progressTabDescription(tab)}</div>;
}

export function SectionLinkButton({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} style={styles.linkBtn}>
      {label}
    </Link>
  );
}

export function RangeBadge({ range }: { range: ProgressRange }) {
  return <span style={styles.chip}>{rangeChipLabel(range)}</span>;
}

export function FilterBar({
  children,
}: {
  children: React.ReactNode;
}) {
  return <form method="get" style={styles.filterBar}>{children}</form>;
}

export function FilterInput({
  name,
  defaultValue,
  placeholder,
}: {
  name: string;
  defaultValue?: string;
  placeholder: string;
}) {
  return <input name={name} defaultValue={defaultValue} placeholder={placeholder} style={styles.input} />;
}

export function FilterSelect({
  name,
  defaultValue,
  options,
}: {
  name: string;
  defaultValue?: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select name={name} defaultValue={defaultValue} style={styles.input}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

const border = "1px solid rgba(128,128,128,0.35)";

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: 1120, margin: "0 auto", padding: "20px 14px" },
  topRow: { display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" },
  h1: { margin: 0, fontSize: 28, fontWeight: 900 },
  sub: { marginTop: 6, opacity: 0.75, fontSize: 13 },
  pillRow: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 },
  pill: {
    padding: "8px 12px",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "rgba(128,128,128,0.45)",
    borderRadius: 999,
    textDecoration: "none",
    color: "inherit",
    background: "rgba(128,128,128,0.08)",
    fontSize: 13,
    fontWeight: 800,
  },
  pillActive: {
    background: "rgba(76,163,255,0.18)",
    borderColor: "rgba(76,163,255,0.45)",
  },
  overlayNav: { display: "grid", gap: 12, marginBottom: 6 },
  section: { border, borderRadius: 14, overflow: "hidden" },
  sectionHeader: {
    padding: "10px 14px",
    background: "rgba(128,128,128,0.14)",
    borderBottom: "1px solid rgba(128,128,128,0.25)",
    fontWeight: 900,
    letterSpacing: 0.3,
  },
  targetCard: {
    border,
    borderRadius: 12,
    padding: 12,
    background: "rgba(128,128,128,0.06)",
    color: "inherit",
    textDecoration: "none",
    display: "block",
  },
  chip: {
    border: "1px solid rgba(128,128,128,0.35)",
    borderRadius: 999,
    padding: "4px 8px",
    fontSize: 12,
    background: "rgba(128,128,128,0.08)",
  },
  statGrid: {
    display: "grid",
    gap: 10,
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  },
  statCard: {
    border,
    borderRadius: 12,
    padding: 12,
    background: "rgba(128,128,128,0.06)",
  },
  linkBtn: {
    padding: "8px 12px",
    border: "1px solid rgba(128,128,128,0.8)",
    borderRadius: 10,
    textDecoration: "none",
    color: "inherit",
    fontWeight: 800,
    background: "rgba(128,128,128,0.12)",
  },
  tabHint: { fontSize: 12, opacity: 0.75, marginTop: 4 },
  filterBar: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" },
  input: {
    padding: "8px 10px",
    border: "1px solid rgba(128,128,128,0.45)",
    borderRadius: 10,
    background: "rgba(128,128,128,0.08)",
    color: "inherit",
    minWidth: 180,
  },
};
