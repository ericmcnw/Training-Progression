"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useLogDraft } from "@/app/contexts/LogDraftContext";

// Five stable destinations: do work in Log, organize it in Plan, inspect a
// sport or training domain in Activities, and keep health/data under Profile.
const desktopNavItems = [
  { href: "/", label: "Home", match: (pathname: string) => pathname === "/" },
  { href: "/log", label: "Log", match: (pathname: string) => pathname.startsWith("/log") || pathname.startsWith("/routines") },
  { href: "/plan", label: "Plan", match: (pathname: string) => pathname.startsWith("/plan") || pathname.startsWith("/programs") || pathname.startsWith("/schedule") || pathname.startsWith("/goals") },
  { href: "/activities", label: "Activities", match: (pathname: string) => pathname.startsWith("/activities") },
  { href: "/profile", label: "Profile", match: (pathname: string) => pathname.startsWith("/profile") || pathname.startsWith("/body") || pathname.startsWith("/injuries") },
];

const mobileNavItems = [
  { href: "/", label: "Home", icon: <HomeIcon />, match: (pathname: string) => pathname === "/" },
  { href: "/log", label: "Log", icon: <LogIcon />, match: (pathname: string) => pathname.startsWith("/log") || pathname.startsWith("/routines") },
  { href: "/plan", label: "Plan", icon: <ScheduleIcon />, match: (pathname: string) => pathname.startsWith("/plan") || pathname.startsWith("/programs") || pathname.startsWith("/schedule") || pathname.startsWith("/goals") },
  { href: "/activities", label: "Activities", icon: <ActivitiesIcon />, match: (pathname: string) => pathname.startsWith("/activities") },
  { href: "/profile", label: "Profile", icon: <ProfileIcon />, match: (pathname: string) => pathname.startsWith("/profile") || pathname.startsWith("/body") || pathname.startsWith("/injuries") },
];

export default function AppNavigation() {
  const pathname = usePathname();
  const { allDrafts } = useLogDraft();
  const draftCount = allDrafts.length;

  return (
    <nav className="appNav" aria-label="Primary">
      {desktopNavItems.map((item) => {
        const active = item.match(pathname);
        const showBadge = item.href === "/log" && draftCount > 0;

        return (
          <Link
            key={item.href}
            className="navLink"
            href={item.href}
            aria-current={active ? "page" : undefined}
            style={{ position: "relative" }}
          >
            {item.label}
            {showBadge && <span style={draftBadgeStyle}>{draftCount}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileBottomNavigation() {
  const pathname = usePathname();
  const { allDrafts } = useLogDraft();
  const draftCount = allDrafts.length;

  return (
    <nav className="mobileBottomNav" aria-label="Mobile primary">
      <div className="mobileBottomNavInner">
      {mobileNavItems.map((item) => {
          const active = item.match(pathname);
          const showBadge = item.href === "/log" && draftCount > 0;

          return (
            <Link
              key={item.href}
              className="mobileBottomNavLink"
              href={item.href}
              aria-current={active ? "page" : undefined}
              aria-label={item.label}
            >
              <span className="mobileBottomNavIcon" aria-hidden="true" style={{ position: "relative" }}>
                {item.icon}
                {showBadge && (
                  <span style={draftBadgeStyle}>{draftCount}</span>
                )}
              </span>
              <span className="mobileBottomNavText">{item.label}</span>
            </Link>
          );
      })}
      </div>
    </nav>
  );
}

function MobileNavIcon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

function HomeIcon() {
  return (
    <MobileNavIcon>
      <path d="M3.5 10.5 12 3l8.5 7.5" />
      <path d="M6.5 9.5V20h11V9.5" />
      <path d="M10 20v-5.5h4V20" />
    </MobileNavIcon>
  );
}

function LogIcon() {
  return (
    <MobileNavIcon>
      <path d="M7 3.5h8l3 3V20a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 20V5A1.5 1.5 0 0 1 7.5 3.5Z" />
      <path d="M15 3.5V7h3" />
      <path d="m8.5 11 1.2 1.2 2-2.2" />
      <path d="M12.5 11H16" />
      <path d="m8.5 15.5 1.2 1.2 2-2.2" />
      <path d="M12.5 15.5H16" />
    </MobileNavIcon>
  );
}

function ActivitiesIcon() {
  // A compass / target glyph — evokes "where do I want to train today"
  return (
    <MobileNavIcon>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m9 15 2-6 6-2-2 6Z" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </MobileNavIcon>
  );
}

function ScheduleIcon() {
  return (
    <MobileNavIcon>
      <rect x="4" y="5.5" width="16" height="14.5" rx="2.5" />
      <path d="M8 3.5v4" />
      <path d="M16 3.5v4" />
      <path d="M4 9.5h16" />
      <path d="M8 13h3" />
      <path d="M13 13h3" />
      <path d="M8 16.5h3" />
    </MobileNavIcon>
  );
}

export function MobileProfileButton() {
  const pathname = usePathname();
  const active = pathname.startsWith("/profile") || pathname.startsWith("/body") || pathname.startsWith("/injuries");
  return (
    <Link
      href="/profile"
      className="mobileProfileButton"
      aria-current={active ? "page" : undefined}
      aria-label="Profile"
    >
      <span className="mobileProfileButtonIcon" aria-hidden="true">
        <ProfileIcon />
      </span>
      <span>Profile</span>
    </Link>
  );
}

function ProfileIcon() {
  return (
    <MobileNavIcon>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.866 3.134-7 7-7s7 3.134 7 7" />
    </MobileNavIcon>
  );
}

const draftBadgeStyle: React.CSSProperties = {
  position: "absolute",
  top: -5,
  right: -5,
  minWidth: 16,
  height: 16,
  padding: "0 3px",
  background: "#fbbf24",
  borderRadius: 99,
  fontSize: 9,
  fontWeight: 900,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#000",
  lineHeight: 1,
  pointerEvents: "none",
};
