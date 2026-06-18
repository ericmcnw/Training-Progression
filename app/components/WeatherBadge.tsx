import type { CSSProperties } from "react";
import { describeWeatherCode, type WeatherSnapshot } from "@/lib/weather";

// Compact weather chip for logged sessions — emoji + temp + condition. The
// `detailed` variant adds feels-like / wind / precip for the full log detail.
// Pure presentational (no hooks) so it works in server and client trees.
export default function WeatherBadge({
  weather,
  detailed = false,
}: {
  weather: WeatherSnapshot;
  detailed?: boolean;
}) {
  const d = describeWeatherCode(weather.code);
  return (
    <span
      style={badge}
      title={`${d.label} · ${weather.tempF}° (feels ${weather.feelsLikeF}°) · ${weather.windMph} mph wind`}
    >
      <span aria-hidden style={{ fontSize: detailed ? 15 : 13 }}>{d.emoji}</span>
      <span style={temp}>{weather.tempF}°</span>
      <span style={label}>{d.label}</span>
      {detailed ? (
        <span style={extra}>
          feels {weather.feelsLikeF}° · {weather.windMph} mph
          {weather.precipIn > 0 ? ` · ${weather.precipIn}" precip` : ""}
        </span>
      ) : null}
    </span>
  );
}

const badge: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "4px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.10)",
  background: "rgba(255,255,255,0.04)",
  fontSize: 12,
  fontWeight: 700,
  color: "rgba(255,255,255,0.78)",
  whiteSpace: "nowrap",
  maxWidth: "100%",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const temp: CSSProperties = { fontWeight: 900, color: "rgba(255,255,255,0.95)" };

const label: CSSProperties = { fontWeight: 700, opacity: 0.8 };

const extra: CSSProperties = { fontWeight: 600, opacity: 0.6 };
