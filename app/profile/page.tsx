import Link from "next/link";
import ProfileHeader from "@/app/profile/ProfileHeader";
import { loadProfileStats } from "@/lib/profile-stats";
import { getProfileIdentity } from "@/lib/profile-identity";
import { getHomeInjuries } from "@/lib/home-injuries";
import { getProgramCards } from "@/app/programs/data";
import { getAppSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { todayAppYmd } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await getAppSession();
  const [stats, identity, injuries, programs, latestMeasurement] = await Promise.all([
    loadProfileStats(todayAppYmd()),
    getProfileIdentity(),
    getHomeInjuries(),
    getProgramCards(),
    prisma.bodyMeasurement.findFirst({
      where: { profileKey: session.profileKey },
      orderBy: { measuredAt: "desc" },
      select: { measuredAt: true, weightKg: true },
    }),
  ]);
  const activePrograms = programs.filter((program) => program.status === "ACTIVE").length;
  const weightLb = latestMeasurement?.weightKg ? latestMeasurement.weightKg * 2.2046226218 : null;

  return <main style={page}>
    <header style={header}>
      <h1 style={title}>Profile</h1>
      <Link href="/profile/settings" style={settingsLink}>Settings</Link>
    </header>
    <ProfileHeader stats={stats} identity={identity} />

    <section style={group}>
      <h2 style={groupTitle}>Training</h2>
      <div style={navGrid}>
        <HubLink href="/programs" title="Programs" meta={`${activePrograms} active · plans and progress`} />
        <HubLink href="/profile/history" title="Training history" meta={`${stats.totalSessions} sessions · search and review logs`} />
        <HubLink href="/reports" title="Reports" meta="Weekly review and longer trends" />
      </div>
    </section>

    <section style={group}>
      <h2 style={groupTitle}>Health and data</h2>
      <div style={navGrid}>
        <HubLink href="/profile/health" title="Health" meta={injuries.length ? `${injuries.length} active issue${injuries.length === 1 ? "" : "s"} · pain and recovery` : "Pain, injuries, and recovery"} />
        <HubLink href="/profile/measurements" title="Measurements" meta={weightLb ? `Latest weight ${weightLb.toFixed(1)} lb` : "Weight and body measurements"} />
        <HubLink href="/gear" title="Gear" meta="Equipment and packing lists" />
      </div>
    </section>
  </main>;
}

function HubLink({ href, title, meta }: { href: string; title: string; meta: string }) {
  return <Link href={href} style={hubLink}><span style={hubTitle}>{title}</span><span style={hubMeta}>{meta}</span><span aria-hidden style={chevron}>›</span></Link>;
}

const page: React.CSSProperties = { maxWidth: 820, margin: "0 auto", padding: "16px clamp(12px, 3vw, 24px) 96px", display: "grid", gap: 18 };
const header: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between" };
const title: React.CSSProperties = { margin: 0, fontSize: 25, fontWeight: 900 };
const settingsLink: React.CSSProperties = { minHeight: 40, display: "inline-flex", alignItems: "center", padding: "0 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.13)", color: "rgba(255,255,255,0.68)", textDecoration: "none", fontSize: 12, fontWeight: 800 };
const group: React.CSSProperties = { display: "grid", gap: 8 };
const groupTitle: React.CSSProperties = { margin: 0, fontSize: 11, textTransform: "uppercase", color: "rgba(255,255,255,0.42)", fontWeight: 900 };
const navGrid: React.CSSProperties = { display: "grid", gap: 7 };
const hubLink: React.CSSProperties = { display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: "2px 10px", minHeight: 58, alignContent: "center", padding: "9px 13px", borderRadius: 9, border: "1px solid rgba(255,255,255,0.09)", background: "rgba(255,255,255,0.025)", color: "inherit", textDecoration: "none" };
const hubTitle: React.CSSProperties = { fontSize: 13.5, fontWeight: 900 };
const hubMeta: React.CSSProperties = { fontSize: 11.5, color: "rgba(255,255,255,0.52)" };
const chevron: React.CSSProperties = { gridColumn: 2, gridRow: "1 / span 2", alignSelf: "center", color: "rgba(255,255,255,0.32)", fontSize: 20 };
