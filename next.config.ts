import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    // Phase 2 nav restructure. Most specific patterns first — Next.js evaluates
    // these in order, and we want /progress/sports/:slug to match before the
    // bare /progress/sports redirect would otherwise apply.
    return [
      // Sport / cardio detail pages → unified activity-world detail.
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
      // Old sport / cardio index pages → new Activities landing (filtered).
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
      // Injuries are now folded into the Body tab.
      {
        source: "/progress/injuries",
        destination: "/body",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
