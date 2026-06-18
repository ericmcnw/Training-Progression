"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { getCurrentWeatherAt } from "@/app/profile/home-location-actions";
import { describeWeatherCode, type WeatherSnapshot } from "@/lib/weather";

// Compact live-conditions chip for the "Last 7 days" strip corner. Defaults to
// home-base conditions; tapping fetches the device's current location and
// reskins the chip until you tap again (a temporary override — it never
// changes the saved home base). With no home base set, it's a nudge to set one.
export default function HomeWeatherControl({
  home,
  homeLabel,
}: {
  home: WeatherSnapshot | null;
  homeLabel: string | null;
}) {
  const [override, setOverride] = useState<WeatherSnapshot | null>(null);
  const [usingCurrent, setUsingCurrent] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!home && !override) {
    return (
      <Link href="/profile" style={setLink}>
        📍 Set location
      </Link>
    );
  }

  function onTap() {
    if (usingCurrent) {
      setUsingCurrent(false); // back to home
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const w = await getCurrentWeatherAt(pos.coords.latitude, pos.coords.longitude);
        setBusy(false);
        if (w) {
          setOverride(w);
          setUsingCurrent(true);
        }
      },
      () => setBusy(false),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
    );
  }

  const shown = usingCurrent ? override : home;
  if (!shown) return null;
  const d = describeWeatherCode(shown.code);
  const label = usingCurrent ? "Current" : homeLabel;

  return (
    <button
      type="button"
      onClick={onTap}
      disabled={busy}
      style={chip}
      title={
        usingCurrent
          ? "Showing current location — tap to return to home"
          : "Tap to use your current location"
      }
    >
      <span aria-hidden style={{ opacity: 0.7 }}>📍</span>
      {label ? <span style={labelStyle}>{label}</span> : null}
      <span aria-hidden>{d.emoji}</span>
      <span style={temp}>{busy ? "…" : `${shown.tempF}°`}</span>
    </button>
  );
}

const chip: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  maxWidth: 180,
  padding: "3px 8px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.05)",
  color: "rgba(255,255,255,0.8)",
  fontSize: 11.5,
  fontWeight: 800,
  cursor: "pointer",
  minHeight: 0,
  whiteSpace: "nowrap",
};

const labelStyle: CSSProperties = {
  maxWidth: 90,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  opacity: 0.75,
  fontWeight: 700,
};

const temp: CSSProperties = { fontWeight: 900, color: "rgba(255,255,255,0.95)" };

const setLink: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  color: "rgba(255,255,255,0.5)",
  textDecoration: "none",
  whiteSpace: "nowrap",
};
