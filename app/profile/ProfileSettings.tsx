import Link from "next/link";
import { signOut } from "@/app/signin/actions";
import SportsAddButton, {
  type AvailableSport,
  type SelectedSportLite,
} from "@/app/routines/SportsAddButton";
import HomeLocationSetting from "@/app/profile/HomeLocationSetting";
import type { HomeLocation } from "@/lib/home-location";

// Profile settings card.
//   • Account — reflects the lib/auth session seam. Inert until a provider is
//     wired (authMode "single-user-dev"); lights up to a sign-out affordance
//     once authenticated.
//   • Sports — see what's enabled and add/remove (reuses the SPORT-section
//     picker so there's one source of truth).
//   • Units — display preference placeholder; becomes a real per-account
//     setting alongside multi-user (see docs/auth-implementation-checklist.md).
//   • Data — full JSON export (a real backup, downloads from /profile/export).
export default function ProfileSettings({
  selectedSports,
  availableSports,
  authMode,
  isAuthenticated,
  homeLocation,
}: {
  selectedSports: SelectedSportLite[];
  availableSports: AvailableSport[];
  authMode: string;
  isAuthenticated: boolean;
  homeLocation: HomeLocation | null;
}) {
  const authProviderConfigured = authMode === "authenticated";

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={rowStyle}>
        <div style={{ display: "grid", gap: 3, minWidth: 0 }}>
          <div style={rowTitleStyle}>Account</div>
          <div style={rowMetaStyle}>
            {isAuthenticated
              ? "Signed in"
              : authProviderConfigured
              ? "Not signed in"
              : "Single-user mode — accounts arrive with multi-user"}
          </div>
        </div>
        <div style={{ flexShrink: 0 }}>
          {isAuthenticated ? (
            <form action={signOut}>
              <button type="submit" style={neutralBtnStyle}>
                Sign out
              </button>
            </form>
          ) : authProviderConfigured ? (
            <Link href="/signin" style={neutralBtnStyle}>
              Sign in
            </Link>
          ) : (
            <span style={disabledBtnStyle} aria-disabled>
              Sign in
            </span>
          )}
        </div>
      </div>

      <div style={rowStyle}>
        <div style={{ display: "grid", gap: 3, minWidth: 0 }}>
          <div style={rowTitleStyle}>Units</div>
          <div style={rowMetaStyle}>Per-account display preference — arrives with sign-in.</div>
        </div>
        <div style={segmentedStyle} role="radiogroup" aria-label="Units" aria-disabled>
          <span style={{ ...segmentStyle, ...segmentActiveStyle }}>Imperial</span>
          <span style={segmentStyle}>Metric</span>
        </div>
      </div>

      <HomeLocationSetting initial={homeLocation} />

      <div style={rowStyle}>
        <div style={{ display: "grid", gap: 3, minWidth: 0 }}>
          <div style={rowTitleStyle}>Sports</div>
          <div style={rowMetaStyle}>
            {selectedSports.length > 0
              ? selectedSports.map((s) => s.label).join(" · ")
              : "No sports added yet"}
          </div>
        </div>
        <div style={{ flexShrink: 0 }}>
          <SportsAddButton selected={selectedSports} available={availableSports} />
        </div>
      </div>

      <div style={rowStyle}>
        <div style={{ display: "grid", gap: 3, minWidth: 0 }}>
          <div style={rowTitleStyle}>Export data</div>
          <div style={rowMetaStyle}>Download every routine, log, and climb as JSON.</div>
        </div>
        <a href="/profile/export" download style={exportBtnStyle}>
          ⭳ Export
        </a>
      </div>
    </div>
  );
}

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.07)",
  background: "rgba(255,255,255,0.03)",
};

const rowTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
};

const rowMetaStyle: React.CSSProperties = {
  fontSize: 11.5,
  opacity: 0.62,
  fontWeight: 600,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const exportBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "9px 14px",
  borderRadius: 10,
  border: "1px solid rgba(120,190,255,0.4)",
  background: "rgba(120,190,255,0.14)",
  color: "rgba(191,219,254,0.98)",
  fontSize: 12.5,
  fontWeight: 900,
  textDecoration: "none",
  whiteSpace: "nowrap",
  minHeight: 40,
  flexShrink: 0,
};

const neutralBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "9px 14px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.06)",
  color: "inherit",
  fontSize: 12.5,
  fontWeight: 900,
  textDecoration: "none",
  whiteSpace: "nowrap",
  minHeight: 40,
};

const disabledBtnStyle: React.CSSProperties = {
  ...neutralBtnStyle,
  opacity: 0.4,
  cursor: "not-allowed",
};

const segmentedStyle: React.CSSProperties = {
  display: "inline-flex",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.12)",
  overflow: "hidden",
  opacity: 0.5,
  flexShrink: 0,
};

const segmentStyle: React.CSSProperties = {
  padding: "9px 12px",
  fontSize: 12.5,
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const segmentActiveStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.12)",
};
