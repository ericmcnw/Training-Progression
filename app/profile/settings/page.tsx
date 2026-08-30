import Link from "next/link";
import type { CSSProperties } from "react";
import { getAppSession } from "@/lib/auth";
import { listSelectedSports, listUnselectedSports } from "@/lib/synthetic-sport-routines";
import { getHomeLocation } from "@/lib/home-location";
import { getActivityEntry } from "@/lib/activity-families";
import { getProfileIdentity } from "@/lib/profile-identity";
import ProfileSettings from "@/app/profile/ProfileSettings";
import IdentitySetting from "@/app/profile/IdentitySetting";

export const dynamic = "force-dynamic";

// Settings hub. Owns the global preferences (account / units / location /
// sports / data via ProfileSettings) and links out to the deep per-domain
// config that already lives in its own context, rather than absorbing it.
export default async function SettingsPage() {
  const [selectedSportsRaw, availableSports, session, homeLocation, identity] = await Promise.all([
    listSelectedSports(),
    listUnselectedSports(),
    getAppSession(),
    getHomeLocation(),
    getProfileIdentity(),
  ]);
  const selectedSports = selectedSportsRaw.map((s) => ({
    slug: s.slug,
    label: s.label,
    eyebrow: getActivityEntry(s.slug)?.eyebrow ?? "",
  }));

  return (
    <div style={shell}>
      <div>
        <Link href="/profile" style={backLink}>← Profile</Link>
      </div>
      <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>Settings</h1>

      <IdentitySetting initial={identity} />

      <ProfileSettings
        selectedSports={selectedSports}
        availableSports={availableSports}
        authMode={session?.mode ?? "single-user-dev"}
        isAuthenticated={session?.isAuthenticated ?? false}
        homeLocation={homeLocation}
      />

      {/* Deep per-domain config lives in its own context — link out, don't absorb. */}
      <section style={panel}>
        <div style={panelHeader}>MORE</div>
        <div style={{ display: "grid", gap: 8, padding: 12 }}>
          <Link href="/activities/endurance/settings" style={linkRow}>
            <span style={linkRowTitle}>Endurance activity types</span>
            <span style={linkRowMeta}>Which run/bike/swim types show & their order →</span>
          </Link>
        </div>
      </section>
    </div>
  );
}

const shell: CSSProperties = {
  maxWidth: "var(--app-width-form)",
  margin: "0 auto",
  padding: "16px 12px",
  display: "grid",
  gap: 16,
};

const backLink: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  opacity: 0.65,
  textDecoration: "none",
  color: "inherit",
  padding: "4px 10px",
  borderRadius: 8,
  border: "1px solid rgba(128,128,128,0.2)",
  background: "rgba(128,128,128,0.06)",
};

const panel: CSSProperties = {
  border: "1px solid rgba(128,128,128,0.28)",
  borderRadius: 16,
  overflow: "hidden",
  background: "rgba(255,255,255,0.02)",
};

const panelHeader: CSSProperties = {
  padding: "8px 16px",
  background: "rgba(128,128,128,0.11)",
  borderBottom: "1px solid rgba(128,128,128,0.2)",
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.6,
};

const linkRow: CSSProperties = {
  display: "grid",
  gap: 2,
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.07)",
  background: "rgba(255,255,255,0.03)",
  textDecoration: "none",
  color: "inherit",
};

const linkRowTitle: CSSProperties = { fontSize: 13, fontWeight: 900 };
const linkRowMeta: CSSProperties = { fontSize: 11.5, opacity: 0.62, fontWeight: 600 };
