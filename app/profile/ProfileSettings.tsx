import SportsAddButton, {
  type AvailableSport,
  type SelectedSportLite,
} from "@/app/routines/SportsAddButton";

// Profile settings card. Real, working controls only:
//   • Sports — see what's enabled and add/remove (reuses the SPORT-section
//     picker so there's one source of truth).
//   • Data — full JSON export (a real backup, downloads from /profile/export).
// Account / auth / display prefs return here when those surfaces ship.
export default function ProfileSettings({
  selectedSports,
  availableSports,
}: {
  selectedSports: SelectedSportLite[];
  availableSports: AvailableSport[];
}) {
  return (
    <div style={{ display: "grid", gap: 14 }}>
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
