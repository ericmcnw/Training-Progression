import Link from "next/link";
import { getAppSession } from "@/lib/auth";
import { signOut } from "@/app/signin/actions";
import { todayAppYmd } from "@/lib/dates";
import { getWeekBoundsSunday } from "@/lib/week";

export const dynamic = "force-dynamic";

// First-cut profile page. Shell + minimal sections so we have a real
// destination for the "Profile" nav link (which used to point at
// /manual-log). Each section is a self-contained card so adding
// account/settings surfaces later is just "drop in a new card."
export default async function ProfilePage() {
  const session = await getAppSession();
  const today = todayAppYmd();
  const { startYmd } = getWeekBoundsSunday(new Date());
  const monthKey = today.slice(0, 7); // YYYY-MM
  const yearKey = today.slice(0, 4);  // YYYY

  return (
    <div style={pageStyle}>
      <header style={{ display: "grid", gap: 6, marginBottom: 4 }}>
        <h1 style={titleStyle}>Profile</h1>
        <p style={subtitleStyle}>Settings, reports, and account.</p>
      </header>

      {/* Account */}
      <Section label="Account">
        {session.isAuthenticated ? (
          <div style={{ display: "grid", gap: 8 }}>
            <Row label="Signed in" value={`User ${session.userId?.slice(0, 8)}…`} />
            <Row label="Mode" value="Authenticated (cloud sync)" />
            <form action={signOut}>
              <button type="submit" style={dangerBtnStyle}>Sign out</button>
            </form>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            <Row label="Mode" value="Single-user (local)" />
            <p style={mutedStyle}>
              This build runs in single-user mode. Sign in to enable cloud
              sync once a real account system is wired up. The signin flow
              is already plumbed via Supabase magic links.
            </p>
            <Link href="/signin" style={primaryLinkStyle}>Sign in →</Link>
          </div>
        )}
      </Section>

      {/* Reports */}
      <Section label="Reports">
        <div style={{ display: "grid", gap: 8 }}>
          <p style={mutedStyle}>
            Print-friendly summaries of what you trained. Weekly is live;
            monthly and yearly are mocked up for layout review.
          </p>
          <div style={{ display: "grid", gap: 8 }}>
            <ReportLink
              href={`/reports/weekly?week=${startYmd}`}
              label="Weekly report"
              hint="This week — current sessions, totals, day-by-day"
              status="live"
            />
            <ReportLink
              href="/reports/mockup"
              label="Monthly report (mockup)"
              hint="Layout preview with sample data — print-friendly"
              status="mockup"
            />
            <ReportLink
              href="#"
              label="Yearly report"
              hint="Coming soon — 12-month overview, PRs, training balance retrospective"
              status="soon"
            />
          </div>
          <p style={{ ...mutedStyle, fontSize: 11 }}>
            Tip: open a report, then tap the Print button (top-right) to
            preview how it prints. The on-screen dark theme stays untouched.
          </p>
        </div>
      </Section>

      {/* Display preferences — placeholder so the section exists */}
      <Section label="Display preferences">
        <div style={{ display: "grid", gap: 8 }}>
          <Row label="Units" value="Pounds (lb) · miles · °F" />
          <Row label="Week start" value="Sunday" />
          <Row label="Date format" value="System default" />
          <p style={{ ...mutedStyle, fontSize: 11 }}>
            Settings are read-only for now. Editable preferences ship in a
            follow-up — see the auth roadmap.
          </p>
        </div>
      </Section>

      {/* App tools */}
      <Section label="App">
        <div style={{ display: "grid", gap: 8 }}>
          <ToolLink href="/manual-log" label="Manual log" hint="Backfill or edit past sessions" />
          <ToolLink href="/exercises" label="Exercise library" hint="Add, rename, retire exercises" />
          <ToolLink href="/schedule" label="Schedule" hint="Weekly plan + cycle entries" />
          <ToolLink href="/goals" label="Goals" hint="Frequency goals + group goals" />
          <ToolLink href="/injuries" label="Injuries" hint="Active injuries + recovery notes" />
        </div>
      </Section>

      {/* About */}
      <Section label="About">
        <div style={{ display: "grid", gap: 8 }}>
          <Row label="App" value="Progression Tracker" />
          <Row label="Build" value="dev" />
          <Row label="Auth mode" value={session.mode} />
          <p style={{ ...mutedStyle, fontSize: 11 }}>
            Personal training tracker. Built solo. Roadmap: see
            docs/public-release-roadmap.md.
          </p>
        </div>
      </Section>

      {/* Danger zone — placeholder */}
      <Section label="Danger zone" tone="danger">
        <div style={{ display: "grid", gap: 8 }}>
          <p style={mutedStyle}>
            Account deletion and data export ship with the multi-user
            release. Nothing destructive is enabled here yet.
          </p>
          <button type="button" style={{ ...dangerBtnStyle, opacity: 0.45, cursor: "not-allowed" }} disabled>
            Delete account (disabled)
          </button>
        </div>
      </Section>

      {/* Hidden context for future debugging — only visible at the bottom */}
      <p style={{ fontSize: 10, opacity: 0.35, textAlign: "center", marginTop: 4 }}>
        {today} · week of {startYmd} · {monthKey} · {yearKey}
      </p>
    </div>
  );
}

// ─── Section card ────────────────────────────────────────────────────────────

function Section({
  label,
  tone,
  children,
}: {
  label: string;
  tone?: "danger";
  children: React.ReactNode;
}) {
  const accentBorder = tone === "danger" ? "rgba(248,113,113,0.35)" : "rgba(128,128,128,0.28)";
  const headerBg = tone === "danger" ? "rgba(248,113,113,0.10)" : "rgba(128,128,128,0.10)";
  return (
    <section style={{ ...sectionStyle, borderColor: accentBorder }}>
      <div style={{ ...sectionHeaderStyle, background: headerBg }}>{label}</div>
      <div style={sectionBodyStyle}>{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={rowStyle}>
      <span style={rowLabelStyle}>{label}</span>
      <span style={rowValueStyle}>{value}</span>
    </div>
  );
}

function ReportLink({
  href,
  label,
  hint,
  status,
}: {
  href: string;
  label: string;
  hint: string;
  status: "live" | "mockup" | "soon";
}) {
  const disabled = status === "soon";
  const badge = status === "live" ? "Live" : status === "mockup" ? "Mockup" : "Coming soon";
  const badgeBg =
    status === "live"
      ? "rgba(84,203,130,0.18)"
      : status === "mockup"
      ? "rgba(129,140,248,0.18)"
      : "rgba(255,255,255,0.05)";
  const badgeColor =
    status === "live"
      ? "rgba(84,203,130,0.95)"
      : status === "mockup"
      ? "rgba(199,210,254,0.95)"
      : "rgba(255,255,255,0.55)";
  const content = (
    <div style={{ ...toolLinkStyle, opacity: disabled ? 0.55 : 1, cursor: disabled ? "not-allowed" : "pointer" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
          <span>{label}</span>
          <span
            style={{
              fontSize: 9,
              fontWeight: 900,
              letterSpacing: 0.4,
              textTransform: "uppercase",
              padding: "2px 6px",
              borderRadius: 999,
              background: badgeBg,
              color: badgeColor,
            }}
          >
            {badge}
          </span>
        </div>
        <div style={{ fontSize: 11, opacity: 0.6, marginTop: 3 }}>{hint}</div>
      </div>
      {!disabled ? <span style={{ fontSize: 18, opacity: 0.4 }}>›</span> : null}
    </div>
  );
  if (disabled) return content;
  return <Link href={href} style={{ textDecoration: "none", color: "inherit" }}>{content}</Link>;
}

function ToolLink({ href, label, hint }: { href: string; label: string; hint: string }) {
  return (
    <Link href={href} style={{ textDecoration: "none", color: "inherit" }}>
      <div style={toolLinkStyle}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>{label}</div>
          <div style={{ fontSize: 11, opacity: 0.6, marginTop: 3 }}>{hint}</div>
        </div>
        <span style={{ fontSize: 18, opacity: 0.4 }}>›</span>
      </div>
    </Link>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const pageStyle: React.CSSProperties = {
  maxWidth: 720,
  margin: "0 auto",
  padding: "20px 14px 80px",
  display: "grid",
  gap: 18,
};

const titleStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 900,
  margin: 0,
  letterSpacing: -0.5,
};

const subtitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  opacity: 0.65,
};

const sectionStyle: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.28)",
  borderRadius: 14,
  overflow: "hidden",
  background: "rgba(255,255,255,0.02)",
};

const sectionHeaderStyle: React.CSSProperties = {
  padding: "10px 16px",
  background: "rgba(128,128,128,0.10)",
  borderBottom: "1px solid rgba(128,128,128,0.18)",
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.6,
  textTransform: "uppercase",
};

const sectionBodyStyle: React.CSSProperties = {
  padding: 16,
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: 12,
  padding: "6px 0",
  borderBottom: "1px dashed rgba(255,255,255,0.06)",
};

const rowLabelStyle: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.55,
  fontWeight: 700,
};

const rowValueStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  textAlign: "right",
};

const mutedStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  opacity: 0.65,
  lineHeight: 1.6,
};

const primaryLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 44,
  padding: "10px 16px",
  borderRadius: 10,
  border: "1px solid rgba(129,140,248,0.5)",
  background: "rgba(129,140,248,0.12)",
  color: "rgb(199,210,254)",
  fontWeight: 800,
  fontSize: 13,
  textDecoration: "none",
  alignSelf: "flex-start",
};

const dangerBtnStyle: React.CSSProperties = {
  minHeight: 44,
  padding: "10px 16px",
  borderRadius: 10,
  border: "1px solid rgba(248,113,113,0.5)",
  background: "rgba(248,113,113,0.10)",
  color: "rgba(254,202,202,0.95)",
  fontWeight: 800,
  fontSize: 13,
  cursor: "pointer",
  alignSelf: "flex-start",
};

const toolLinkStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
  minHeight: 44,
};
