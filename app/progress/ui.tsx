import Link from "next/link";
import type { ProgressRange, ProgressSection, ProgressTab } from "@/lib/progress-v2";
import { progressRanges, progressSections, progressTabDescription, progressTabs, rangeChipLabel } from "@/lib/progress-v2";
import HistoryBackButton from "@/app/components/HistoryBackButton";

export function TargetHeader({
  section,
  title,
  subtitle,
  eyebrow,
  basePath,
  tab,
  range,
  availableTabs,
  actions,
  hideTabs,
  hideRange,
  hideSections,
  compact,
}: {
  section: ProgressSection;
  title: string;
  subtitle?: string;
  eyebrow?: string;
  basePath: string;
  tab: ProgressTab;
  range: ProgressRange;
  availableTabs?: ProgressTab[];
  actions?: React.ReactNode;
  hideTabs?: boolean;
  hideRange?: boolean;
  /** Hide the cross-section nav (Overview / Routines / Exercises / etc.).
   *  Used on activity-world pages where the section chips wrap awkwardly
   *  on mobile and the bottom nav already gives back-out navigation. */
  hideSections?: boolean;
  /** Skips the section-nav row and shrinks the hero on mobile. Use on
   *  immersive pages like maps where vertical space matters more than the
   *  global navigation chips. */
  compact?: boolean;
}) {
  return (
    <div
      className={`mobileProgressPage mobilePageShell${compact ? " compactTargetHeader" : ""}`}
      style={styles.container}
    >
      <div className="mobileSectionCard" style={styles.hero}>
        <div style={styles.heroCopy}>
          <div style={styles.eyebrow}>{eyebrow ?? "Progress Target"}</div>
          <h1 className="mobilePageTitle" style={styles.h1}>{title}</h1>
          {subtitle ? <div className="mobilePageSubtitle" style={styles.sub}>{subtitle}</div> : null}
        </div>
        {actions ? <div className="mobileActionRow" style={styles.heroActions}>{actions}</div> : null}
      </div>

      {compact || (hideSections && hideTabs && hideRange) ? null : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginTop: 4 }}>
          {!hideSections && (
            <CompactSegmentedNav items={progressSections().map((item) => ({ ...item, active: item.key === section }))} />
          )}
          {!hideTabs && (
            <>
              {!hideSections && <div style={{ width: 1, height: 14, background: "rgba(255,255,255,0.12)", flexShrink: 0 }} />}
              <CompactSegmentedNav items={progressTabs(basePath, range, availableTabs).map((item) => ({ ...item, active: item.key === tab }))} />
            </>
          )}
          {!hideRange && (
            <>
              {(!hideSections || !hideTabs) && <div style={{ width: 1, height: 14, background: "rgba(255,255,255,0.12)", flexShrink: 0 }} />}
              <CompactSegmentedNav
                items={progressRanges(basePath, tab).map((item) => ({ ...item, active: item.key === range }))}
                replace
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function PillNav({
  items,
}: {
  items: Array<{ href: string; label: string; active?: boolean }>;
}) {
  return <SegmentedNav items={items} />;
}

export function SectionCard({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mobileSectionCard" style={styles.section}>
      <div className="mobileSectionHeader" style={styles.sectionHeaderRow}>
        <div style={{ minWidth: 0 }}>
          <div style={styles.sectionHeader}>{title}</div>
          {subtitle ? <div style={styles.sectionSub}>{subtitle}</div> : null}
        </div>
        {actions ? <div className="mobileActionRow" style={styles.sectionActions}>{actions}</div> : null}
      </div>
      <div className="mobileSectionBody" style={styles.sectionBody}>{children}</div>
    </section>
  );
}

export function TargetCard({
  href,
  title,
  subtitle,
  chips,
  eyebrow,
  description,
  emphasis = "default",
  borderColor,
  background,
  trendChip,
}: {
  href: string;
  title: string;
  subtitle?: string;
  chips?: string[];
  eyebrow?: string;
  description?: string;
  emphasis?: "default" | "featured";
  borderColor?: string;
  background?: string;
  trendChip?: { label: string; style?: React.CSSProperties };
}) {
  const featured = emphasis === "featured";

  return (
    <Link
      href={href}
      style={{
        ...styles.targetCard,
        ...(featured ? styles.targetCardFeatured : {}),
        ...(borderColor ? { borderColor } : {}),
        ...(background ? { background } : {}),
      }}
    >
      {eyebrow ? <div style={styles.cardEyebrow}>{eyebrow}</div> : null}
      <div style={styles.cardTitle}>{title}</div>
      {subtitle ? <div style={styles.cardSubtitle}>{subtitle}</div> : null}
      {description ? <div style={styles.cardDescription}>{description}</div> : null}
      {(chips && chips.length > 0) || trendChip ? (
        <div style={styles.cardChipRow}>
          {chips?.map((chip) => (
            <span key={chip} style={styles.chip}>
              {chip}
            </span>
          ))}
          {trendChip ? (
            <span style={{ ...styles.chip, ...trendChip.style }}>
              {trendChip.label}
            </span>
          ) : null}
        </div>
      ) : null}
    </Link>
  );
}

export function StatGrid({
  items,
}: {
  items: Array<{ label: string; value: string; accent?: string }>;
}) {
  return (
    <div style={styles.statGrid}>
      {items.map((item) => (
        <div key={item.label} style={styles.statCard}>
          <div style={styles.statLabel}>{item.label}</div>
          <div style={{ ...styles.statValue, ...(item.accent ? { color: item.accent } : {}) }}>{item.value}</div>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <div style={styles.emptyState}>{message}</div>;
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

// History-aware back variant of SectionLinkButton — uses
// router.back() when the page has prior history (so users land back
// where they came from), falls back to `fallbackHref` otherwise.
// Use this anywhere a page is reachable from multiple entry points.
export function SectionBackButton({ fallbackHref, label }: { fallbackHref: string; label: string }) {
  return <HistoryBackButton fallbackHref={fallbackHref} label={label} style={styles.linkBtn} />;
}

export function RangeBadge({ range }: { range: ProgressRange }) {
  return <span style={styles.chip}>{rangeChipLabel(range)}</span>;
}

export function FilterBar({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <form method="get" style={styles.filterBar} suppressHydrationWarning>
      {children}
    </form>
  );
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
  return <input name={name} defaultValue={defaultValue} placeholder={placeholder} style={styles.input} suppressHydrationWarning />;
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
    <select name={name} defaultValue={defaultValue} style={styles.input} suppressHydrationWarning>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function FilterSubmitButton({ label = "Apply" }: { label?: string }) {
  return (
    <button type="submit" style={styles.filterSubmitButton} suppressHydrationWarning>
      {label}
    </button>
  );
}

function CompactSegmentedNav({
  items,
  replace = false,
}: {
  items: Array<{ href: string; label: string; active?: boolean }>;
  /** When true, navigation replaces the current history entry instead of
   *  pushing a new one. Pass for range filters (time-frame toggles) so
   *  Back doesn't reverse the user's filter changes one at a time. Do
   *  NOT pass for section/tab navigation — those should remain in
   *  history. */
  replace?: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
      {items.map((item) => (
        <Link
          key={`${item.href}-${item.label}`}
          href={item.href}
          replace={replace}
          scroll={false}
          prefetch={true}
          style={{
            padding: "4px 9px",
            borderRadius: 8,
            border: "1px solid",
            borderColor: item.active ? "rgba(120,190,255,0.4)" : "rgba(255,255,255,0.08)",
            textDecoration: "none",
            color: "inherit",
            background: item.active
              ? "rgba(120,190,255,0.18)"
              : "rgba(255,255,255,0.03)",
            fontSize: 11,
            fontWeight: 800,
            whiteSpace: "nowrap",
          }}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}

function SegmentedNav({
  items,
}: {
  items: Array<{ href: string; label: string; active?: boolean }>;
}) {
  return (
    <div style={styles.segmentedNav}>
      {items.map((item) => (
        <Link
          key={`${item.href}-${item.label}`}
          href={item.href}
          scroll={false}
          prefetch={true}
          style={{
            ...styles.segment,
            ...(item.active ? styles.segmentActive : {}),
          }}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}

const border = "1px solid rgba(255,255,255,0.12)";
const cardBackground = "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03))";

const styles: Record<string, React.CSSProperties> = {
  container: { maxWidth: "none", padding: "4px 0 20px", display: "grid", gap: 18 },
  content: { marginTop: 2, display: "grid", gap: 16 },
  progressTopBar: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
    minHeight: 40,
    marginBottom: 0,
  },
  progressTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    minWidth: 0,
  },
  progressTitleStack: { display: "grid", gap: 4 },
  progressH1: { margin: 0, fontSize: 24, lineHeight: 1.05, fontWeight: 950 },
  progressSub: { fontSize: 13, lineHeight: 1.4, opacity: 0.78, maxWidth: 760 },
  progressTopActions: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" },
  backBtn: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "7px 10px",
    borderRadius: 999,
    textDecoration: "none",
    color: "inherit",
    fontSize: 12,
    fontWeight: 800,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.04)",
  },
  hero: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "center",
    padding: "12px 14px",
    border,
    borderRadius: 18,
    background:
      "radial-gradient(circle at top left, rgba(51,255,122,0.09), transparent 34%), radial-gradient(circle at top right, rgba(120,190,255,0.14), transparent 26%), linear-gradient(180deg, rgba(20,31,52,0.96), rgba(10,18,31,0.92))",
    boxShadow: "0 14px 30px rgba(0,0,0,0.14)",
  },
  heroCopy: { display: "grid", gap: 4, flex: "1 1 260px", minWidth: 0 },
  heroActions: { display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", justifyContent: "flex-end" },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    fontWeight: 900,
    color: "rgba(163,255,201,0.86)",
  },
  h1: { margin: 0, fontSize: 26, lineHeight: 1.05, fontWeight: 950 },
  sub: { fontSize: 12, lineHeight: 1.4, opacity: 0.75, maxWidth: 760 },
  navStack: { marginTop: 12, display: "grid", gap: 10 },
  navGrid: { display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" },
  navCluster: {
    display: "grid",
    gap: 6,
    padding: "9px 10px",
    border,
    borderRadius: 16,
    background: "rgba(255,255,255,0.035)",
    minWidth: 0,
    overflow: "hidden",
  },
  navHeader: { display: "grid", gap: 2 },
  navLabel: {
    fontSize: 12,
    letterSpacing: 0.9,
    opacity: 0.82,
    fontWeight: 900,
  },
  navHint: { fontSize: 12, opacity: 0.72 },
  segmentedNav: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    minWidth: 0,
  },
  segment: {
    padding: "9px 10px",
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "rgba(255,255,255,0.08)",
    textDecoration: "none",
    color: "inherit",
    background: "rgba(255,255,255,0.035)",
    textAlign: "center",
    fontSize: 12,
    fontWeight: 800,
    overflow: "hidden",
    flexShrink: 0,
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
  },
  segmentActive: {
    background: "linear-gradient(180deg, rgba(120,190,255,0.24), rgba(120,190,255,0.12))",
    borderColor: "rgba(120,190,255,0.42)",
    boxShadow: "0 0 0 1px rgba(120,190,255,0.08), inset 0 1px 0 rgba(255,255,255,0.08)",
  },
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
  section: {
    border,
    borderRadius: 18,
    overflow: "hidden",
    background: "rgba(255,255,255,0.028)",
    boxShadow: "0 10px 24px rgba(0,0,0,0.08)",
  },
  sectionHeaderRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
    padding: "13px 15px 11px",
    background: "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  },
  sectionHeader: { fontWeight: 900, letterSpacing: 0.2, fontSize: 16 },
  sectionSub: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 1.45,
    opacity: 0.72,
    maxWidth: 720,
  },
  sectionActions: { display: "flex", gap: 8, flexWrap: "wrap" },
  sectionBody: { padding: 14, display: "grid", gap: 12 },
  targetCard: {
    border,
    borderRadius: 18,
    padding: 14,
    background: cardBackground,
    color: "inherit",
    textDecoration: "none",
    display: "block",
    minHeight: 112,
  },
  targetCardFeatured: {
    background:
      "radial-gradient(circle at top right, rgba(120,190,255,0.14), transparent 30%), linear-gradient(180deg, rgba(51,255,122,0.12), rgba(255,255,255,0.03))",
    borderColor: "rgba(51,255,122,0.18)",
  },
  cardEyebrow: {
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    opacity: 0.7,
    fontWeight: 900,
  },
  cardTitle: { marginTop: 6, fontWeight: 900, fontSize: 16, lineHeight: 1.25 },
  cardSubtitle: { marginTop: 4, fontSize: 13, opacity: 0.78, lineHeight: 1.45 },
  cardDescription: { marginTop: 10, fontSize: 13, opacity: 0.84, lineHeight: 1.5 },
  cardChipRow: { marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" },
  chip: {
    border: "1px solid rgba(255,255,255,0.11)",
    borderRadius: 999,
    padding: "4px 8px",
    fontSize: 12,
    background: "rgba(255,255,255,0.06)",
  },
  statGrid: {
    display: "grid",
    gap: 10,
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  },
  statCard: {
    border,
    borderRadius: 16,
    padding: 14,
    background: cardBackground,
  },
  statLabel: { fontSize: 12, opacity: 0.7, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.4 },
  statValue: { marginTop: 8, fontSize: 22, lineHeight: 1.15, fontWeight: 950 },
  linkBtn: {
    padding: "6px 11px",
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: 999,
    textDecoration: "none",
    color: "inherit",
    fontSize: 12,
    fontWeight: 800,
    background: "rgba(255,255,255,0.06)",
    whiteSpace: "nowrap",
  },
  tabHint: { fontSize: 12, opacity: 0.75, marginTop: 4 },
  emptyState: {
    padding: "14px 16px",
    border,
    borderRadius: 16,
    background: "rgba(255,255,255,0.03)",
    opacity: 0.82,
    fontSize: 13,
  },
  filterBar: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" },
  filterSubmitButton: { padding: "8px 12px" },
  input: {
    padding: "10px 12px",
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: 12,
    background: "rgba(255,255,255,0.06)",
    color: "inherit",
    minWidth: 0,
    width: "100%",
  },
};
