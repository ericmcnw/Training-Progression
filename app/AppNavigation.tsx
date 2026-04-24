"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const desktopNavItems = [
  { href: "/", label: "Dashboard", match: (pathname: string) => pathname === "/" },
  { href: "/routines", label: "Routines", match: (pathname: string) => pathname.startsWith("/routines") },
  { href: "/progress", label: "Progress", match: (pathname: string) => pathname.startsWith("/progress") },
  { href: "/body", label: "Body", match: (pathname: string) => pathname.startsWith("/body") || pathname.startsWith("/injuries") },
  { href: "/goals", label: "Goals", match: (pathname: string) => pathname.startsWith("/goals") },
  { href: "/schedule", label: "Schedule", match: (pathname: string) => pathname.startsWith("/schedule") },
  { href: "/manual-log", label: "History", match: (pathname: string) => pathname.startsWith("/manual-log") },
];

const mobileNavItems = [
  { href: "/", label: "Home", icon: <HomeIcon />, match: (pathname: string) => pathname === "/" },
  { href: "/routines", label: "Log", icon: <LogIcon />, match: (pathname: string) => pathname.startsWith("/routines") },
  { href: "/progress", label: "Progress", icon: <ProgressIcon />, match: (pathname: string) => pathname.startsWith("/progress") },
  { href: "/goals", label: "Goals", icon: <GoalsIcon />, match: (pathname: string) => pathname.startsWith("/goals") },
  { href: "/body", label: "Body", icon: <BodyIcon />, match: (pathname: string) => pathname.startsWith("/body") || pathname.startsWith("/injuries") },
  { href: "/schedule", label: "Schedule", icon: <ScheduleIcon />, match: (pathname: string) => pathname.startsWith("/schedule") },
];

export default function AppNavigation() {
  const pathname = usePathname();

  return (
    <nav className="appNav" aria-label="Primary">
      {desktopNavItems.map((item) => {
        const active = item.match(pathname);

        return (
          <Link key={item.href} className="navLink" href={item.href} aria-current={active ? "page" : undefined}>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileBottomNavigation() {
  const pathname = usePathname();

  return (
    <nav className="mobileBottomNav" aria-label="Mobile primary">
      <div className="mobileBottomNavInner">
      {mobileNavItems.map((item) => {
          const active = item.match(pathname);

          return (
            <Link
              key={item.href}
              className="mobileBottomNavLink"
              href={item.href}
              aria-current={active ? "page" : undefined}
              aria-label={item.label}
            >
              <span className="mobileBottomNavIcon" aria-hidden="true">
                {item.icon}
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

function ProgressIcon() {
  return (
    <MobileNavIcon>
      <path d="M4 18.5h16" />
      <path d="M6.5 16V12.5" />
      <path d="M10.5 16V9.5" />
      <path d="M14.5 16V6.5" />
      <path d="M18.5 16V11" />
    </MobileNavIcon>
  );
}

function BodyIcon() {
  return (
    <MobileNavIcon>
      <circle cx="12" cy="5" r="2.5" />
      <path d="M12 7.5v6" />
      <path d="M7.5 10h9" />
      <path d="m12 13.5-4 6" />
      <path d="m12 13.5 4 6" />
    </MobileNavIcon>
  );
}

function GoalsIcon() {
  return (
    <MobileNavIcon>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
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
  const active = pathname.startsWith("/manual-log");
  return (
    <Link
      href="/manual-log"
      className="mobileProfileButton"
      aria-current={active ? "page" : undefined}
      aria-label="History"
    >
      <span className="mobileProfileButtonIcon" aria-hidden="true">
        <ProfileIcon />
      </span>
      <span>History</span>
    </Link>
  );
}

function ProfileIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.866 3.134-7 7-7s7 3.134 7 7" />
    </svg>
  );
}
