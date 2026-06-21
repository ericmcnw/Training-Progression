"use client";

import { useEffect, useRef } from "react";
import { recordLocationPing } from "./location-ping-actions";

// Renders nothing. On home-page mount, drops a passive location breadcrumb —
// but ONLY when geolocation permission is already granted, so it never triggers
// a permission prompt (the live-weather chip is where the user opts in). A
// localStorage stamp avoids re-asking the browser on every visit; the server
// action throttles persistence to once an hour regardless.
const LOCAL_THROTTLE_MS = 30 * 60 * 1000;
const STAMP_KEY = "location-ping-last";

export default function LocationPingCapture() {
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    if (typeof navigator === "undefined" || !navigator.geolocation || !navigator.permissions) return;

    try {
      const last = Number(localStorage.getItem(STAMP_KEY) ?? 0);
      if (Date.now() - last < LOCAL_THROTTLE_MS) return;
    } catch {
      // localStorage unavailable (private mode) — fall through and rely on the
      // server-side throttle.
    }

    navigator.permissions
      .query({ name: "geolocation" })
      .then((status) => {
        if (status.state !== "granted") return;
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            try {
              localStorage.setItem(STAMP_KEY, String(Date.now()));
            } catch {
              /* ignore */
            }
            void recordLocationPing(pos.coords.latitude, pos.coords.longitude);
          },
          () => {},
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 1800000 }
        );
      })
      .catch(() => {});
  }, []);

  return null;
}
