import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // The /progress route system was retired in favor of /activities,
    // /routines, /exercises, /body, and /log. These redirects catch any
    // bookmarked or in-code links that still target the old URLs so
    // nothing 404s after the dead-code sweep.
    //
    // Next.js evaluates redirects in order — most specific patterns
    // first, generic catch-all last.
    return [
      // ── Sports + cardio (legacy detail + index pages) ──────────────────
      {
        source: "/progress/sports/:slug",
        destination: "/activities/:slug?tab=overview&range=4w",
        permanent: false,
      },
      {
        source: "/progress/cardio/:slug",
        destination: "/activities/:slug?tab=overview&range=4w",
        permanent: false,
      },
      {
        source: "/progress/sports",
        destination: "/activities?family=sports",
        permanent: false,
      },
      {
        source: "/progress/cardio",
        destination: "/activities?family=endurance",
        permanent: false,
      },

      // ── Exercises (moved to the standalone library route) ─────────────
      {
        source: "/progress/exercises/:slug",
        // Preserve the slug so users land on the exercise's detail
        // page, not the bare library. Was dropping the slug and
        // bouncing to /exercises before 2026-06-02.
        destination: "/exercises/:slug",
        permanent: false,
      },
      {
        source: "/progress/exercises",
        destination: "/exercises",
        permanent: false,
      },
      {
        source: "/progress/exercise/:slug",
        destination: "/exercises/:slug",
        permanent: false,
      },
      {
        source: "/progress/exercise",
        destination: "/exercises",
        permanent: false,
      },

      // ── Routines (per-routine pages live at /routines/:id) ────────────
      {
        source: "/progress/routines/:slug",
        destination: "/routines/:slug",
        permanent: false,
      },
      {
        source: "/progress/routines",
        destination: "/log",
        permanent: false,
      },
      {
        source: "/progress/routine/:slug",
        destination: "/routines/:slug",
        permanent: false,
      },

      // ── Body (groups + injuries folded into /body) ────────────────────
      {
        source: "/progress/groups/:slug",
        destination: "/body",
        permanent: false,
      },
      {
        source: "/progress/groups",
        destination: "/body",
        permanent: false,
      },
      {
        source: "/progress/injuries",
        destination: "/body",
        permanent: false,
      },

      // ── Catch-all fallback for any /progress URL not handled above ────
      {
        source: "/progress/:path*",
        destination: "/activities",
        permanent: false,
      },
      {
        source: "/progress",
        destination: "/activities",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
