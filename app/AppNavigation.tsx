"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const desktopNavItems = [
  { href: "/", label: "Dashboard", match: (pathname: string) => pathname === "/" },
  { href: "/routines", label: "Routines", match: (pathname: string) => pathname.startsWith("/routines") },
  { href: "/progress", label: "Progress", match: (pathname: string) => pathname.startsWith("/progress") },
  { href: "/goals", label: "Goals", match: (pathname: string) => pathname.startsWith("/goals") },
  { href: "/schedule", label: "Schedule", match: (pathname: string) => pathname.startsWith("/schedule") },
  { href: "/manual-log", label: "Manual Log", match: (pathname: string) => pathname.startsWith("/manual-log") },
];

const mobileNavItems = [
  { href: "/", label: "Home", icon: <HomeIcon />, match: (pathname: string) => pathname === "/" },
  { href: "/routines", label: "Log", icon: <LogIcon />, match: (pathname: string) => pathname.startsWith("/routines") },
  { href: "/goals", label: "Goals", icon: <GoalsIcon />, match: (pathname: string) => pathname.startsWith("/goals") },
  { href: "/schedule", label: "Schedule", icon: <ScheduleIcon />, match: (pathname: string) => pathname.startsWith("/schedule") },
  { href: "/manual-log", label: "Account", icon: <AccountIcon />, match: (pathname: string) => pathname.startsWith("/manual-log") },
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

function GoalsIcon() {
  return (
    <MobileNavIcon>
      <path d="M4 12a8 8 0 1 1 3 6.25" />
      <path d="M12 7.5v5l3 1.5" />
      <path d="M4 18.5h4v-4" />
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

function AccountIcon() {
  return (
    <MobileNavIcon>
      <path d="M12 12a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z" />
      <path d="M5 20a7.5 7.5 0 0 1 14 0" />
    </MobileNavIcon>
  );
}
