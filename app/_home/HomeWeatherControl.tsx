"use client";

import { useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { setActiveLocation, clearActiveLocation } from "@/app/profile/home-location-actions";
import { describeWeatherCode, type WeatherSnapshot } from "@/lib/weather";

// Compact live-conditions chip for the "Last 7 days" strip corner. Shows the
// active location's conditions (home base by default). Tapping persists the
// device's current location as an override — it survives refresh and steers
// the future WaG forecast days too — until you tap again to return to home.
// The override is device-local and never changes the saved home base. With no
// location at all, it's a nudge to set one.
export default function HomeWeatherControl({
  current,
  label,
  isOverride,
}: {
  current: WeatherSnapshot | null;
  label: string | null;
  isOverride: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (!current) {
    return (
      <Link href="/profile" style={setLink}>
        📍 Set location
      </Link>
    );
  }

  async function onTap() {
    if (busy) return;
    if (isOverride) {
      setBusy(true);
      await clearActiveLocation();
      router.refresh();
      setBusy(false);
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await setActiveLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        router.refresh();
        setBusy(false);
      },
      () => setBusy(false),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
    );
  }

  const d = describeWeatherCode(current.code);

  return (
    <button
      type="button"
      onClick={onTap}
      disabled={busy}
      style={chip}
      title={
        isOverride
          ? "Showing your current location — tap to return to home"
          : "Tap to use your current location"
      }
    >
      <span aria-hidden style={{ opacity: 0.7 }}>📍</span>
      {label ? <span style={labelStyle}>{label}</span> : null}
      <span aria-hidden>{d.emoji}</span>
      <span style={temp}>{busy ? "…" : `${current.tempF}°`}</span>
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
