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
  const [err, setErr] = useState<string | null>(null);

  if (!current) {
    return (
      <Link href="/profile" style={setLink}>
        📍 Set location
      </Link>
    );
  }

  async function onTap() {
    if (busy) return;
    setErr(null);
    if (isOverride) {
      setBusy(true);
      await clearActiveLocation();
      router.refresh();
      setBusy(false);
      return;
    }
    // Geolocation is hard-blocked outside a secure context (HTTPS or
    // localhost). Surfacing this is the difference between "nothing happens"
    // and the user knowing they need to open the app over HTTPS.
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setErr("Location needs HTTPS — open the app over https://");
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setErr("Location isn't available on this device");
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await setActiveLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        router.refresh();
        setBusy(false);
      },
      (e) => {
        setBusy(false);
        setErr(geoMessage(e));
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
    );
  }

  if (err) {
    return (
      <button type="button" onClick={onTap} style={errChip} title={`${err} — tap to retry`}>
        <span aria-hidden>⚠️</span>
        <span style={labelStyle}>{err}</span>
      </button>
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

function geoMessage(e: GeolocationPositionError): string {
  if (e.code === e.PERMISSION_DENIED) return "Location blocked — allow it or use HTTPS";
  if (e.code === e.POSITION_UNAVAILABLE) return "Location unavailable";
  if (e.code === e.TIMEOUT) return "Location timed out — tap to retry";
  return "Couldn't get location";
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

const errChip: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  maxWidth: 220,
  padding: "3px 8px",
  borderRadius: 999,
  border: "1px solid rgba(248,113,113,0.35)",
  background: "rgba(248,113,113,0.10)",
  color: "rgba(255,210,210,0.9)",
  fontSize: 11,
  fontWeight: 700,
  cursor: "pointer",
  minHeight: 0,
  whiteSpace: "nowrap",
};

const setLink: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  color: "rgba(255,255,255,0.5)",
  textDecoration: "none",
  whiteSpace: "nowrap",
};
