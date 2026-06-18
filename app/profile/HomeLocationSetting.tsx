"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { setHomeLocation, clearHomeLocation } from "./home-location-actions";
import { describeWeatherCode } from "@/lib/weather";
import type { HomeLocation } from "@/lib/home-location";

type OsmResult = {
  lat: string;
  lon: string;
  display_name: string;
  address?: Record<string, string>;
};

// Compact "City, State" from a Nominatim hit, falling back to the first two
// comma-parts of the full display name.
function shortLabel(r: { display_name: string; address?: Record<string, string> }): string {
  const a = r.address ?? {};
  const place = a.city || a.town || a.village || a.hamlet || a.county || a.suburb;
  const region = a.state || a.region || a.country;
  if (place && region) return `${place}, ${region}`;
  if (place) return place;
  return r.display_name.split(",").slice(0, 2).join(",").trim();
}

export default function HomeLocationSetting({ initial }: { initial: HomeLocation | null }) {
  const [value, setValue] = useState<HomeLocation | null>(initial);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OsmResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          trimmed
        )}&format=json&limit=5&addressdetails=1`;
        const res = await fetch(url, { headers: { "Accept-Language": "en" } });
        const data = (await res.json()) as OsmResult[];
        if (!cancelled) setResults(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  async function save(lat: number, lng: number, label: string | null) {
    setBusy(true);
    setError(null);
    try {
      const res = await setHomeLocation({ lat, lng, label });
      setValue({ lat, lng, label });
      if (res.weather) {
        const d = describeWeatherCode(res.weather.code);
        setConfirm(`Currently ${d.emoji} ${res.weather.tempF}° · ${d.label}`);
      } else {
        setConfirm("Saved");
      }
      setOpen(false);
      setQuery("");
      setResults([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save location.");
    } finally {
      setBusy(false);
    }
  }

  function useCurrentLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Geolocation isn't available on this device.");
      return;
    }
    setBusy(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        let label: string | null = null;
        try {
          const url = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1&zoom=10`;
          const res = await fetch(url, { headers: { "Accept-Language": "en" } });
          const data = (await res.json()) as OsmResult;
          if (data?.display_name) label = shortLabel(data);
        } catch {
          /* coords are enough; label is best-effort */
        }
        await save(latitude, longitude, label);
      },
      () => {
        setBusy(false);
        setError("Couldn't get your location. On a phone this needs HTTPS + permission.");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
    );
  }

  async function clear() {
    setBusy(true);
    setError(null);
    try {
      await clearHomeLocation();
      setValue(null);
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  }

  const meta = value
    ? value.label ?? `${value.lat.toFixed(3)}, ${value.lng.toFixed(3)}`
    : "Not set — weather falls back here when a log has no location";

  return (
    <div style={shell}>
      <div style={rowStyle}>
        <div style={{ display: "grid", gap: 3, minWidth: 0 }}>
          <div style={rowTitleStyle}>Home location</div>
          <div style={rowMetaStyle}>{meta}</div>
          {confirm ? <div style={confirmStyle}>{confirm}</div> : null}
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          {value ? (
            <button type="button" style={neutralBtnStyle} onClick={clear} disabled={busy}>
              Clear
            </button>
          ) : null}
          <button
            type="button"
            style={primaryBtnStyle}
            onClick={() => {
              setOpen((o) => !o);
              setConfirm(null);
              setError(null);
              if (!open) requestAnimationFrame(() => inputRef.current?.focus());
            }}
            disabled={busy}
          >
            {open ? "Close" : value ? "Edit" : "Set"}
          </button>
        </div>
      </div>

      {open ? (
        <div style={editor}>
          <button type="button" style={gpsBtnStyle} onClick={useCurrentLocation} disabled={busy}>
            📍 Use current location
          </button>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a city or place…"
            style={searchInput}
            autoComplete="off"
            aria-label="Search for a place"
          />
          {searching ? <div style={hintStyle}>Searching…</div> : null}
          {results.length > 0 ? (
            <div style={resultList}>
              {results.map((r, i) => (
                <button
                  key={`${r.lat},${r.lon},${i}`}
                  type="button"
                  style={resultRow}
                  onClick={() => save(Number(r.lat), Number(r.lon), shortLabel(r))}
                  disabled={busy}
                  title={r.display_name}
                >
                  {shortLabel(r)}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? <div style={errorStyle}>{error}</div> : null}
    </div>
  );
}

// ─── Styles (mirror ProfileSettings row chrome) ──────────────────────────────

const shell: CSSProperties = { display: "grid", gap: 8 };

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.07)",
  background: "rgba(255,255,255,0.03)",
};

const rowTitleStyle: CSSProperties = { fontSize: 13, fontWeight: 900 };

const rowMetaStyle: CSSProperties = {
  fontSize: 11.5,
  opacity: 0.62,
  fontWeight: 600,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const confirmStyle: CSSProperties = {
  fontSize: 11.5,
  fontWeight: 800,
  color: "rgba(51,255,122,0.95)",
};

const primaryBtnStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "9px 14px",
  borderRadius: 10,
  border: "1px solid rgba(120,190,255,0.4)",
  background: "rgba(120,190,255,0.14)",
  color: "rgba(191,219,254,0.98)",
  fontSize: 12.5,
  fontWeight: 900,
  cursor: "pointer",
  whiteSpace: "nowrap",
  minHeight: 40,
};

const neutralBtnStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "9px 14px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.06)",
  color: "inherit",
  fontSize: 12.5,
  fontWeight: 900,
  cursor: "pointer",
  whiteSpace: "nowrap",
  minHeight: 40,
};

const editor: CSSProperties = {
  display: "grid",
  gap: 8,
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.02)",
};

const gpsBtnStyle: CSSProperties = {
  ...neutralBtnStyle,
  justifyContent: "center",
  width: "100%",
};

// fontSize 16 — iOS focus-zoom guard.
const searchInput: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(0,0,0,0.25)",
  color: "inherit",
  fontSize: 16,
  fontWeight: 600,
  outline: "none",
  boxSizing: "border-box",
};

const hintStyle: CSSProperties = { fontSize: 11.5, opacity: 0.6, fontWeight: 700, paddingLeft: 2 };

const resultList: CSSProperties = { display: "grid", gap: 2 };

const resultRow: CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  borderRadius: 9,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.03)",
  color: "inherit",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  minHeight: 42,
};

const errorStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "rgba(248,113,113,0.95)",
  paddingLeft: 2,
};
