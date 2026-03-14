"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const desktopNavItems = [
  { href: "/", label: "Dashboard", match: (pathname: string) => pathname === "/" },
  { href: "/routines", label: "Routines", match: (pathname: string) => pathname.startsWith("/routines") },
  { href: "/progress", label: "Progress", match: (pathname: string) => pathname.startsWith("/progress") },
  { href: "/goals", label: "Goals", match: (pathname: string) => pathname.startsWith("/goals") },
  { href: "/schedule", label: "Schedule", match: (pathname: string) => pathname.startsWith("/schedule") },
  { href: "/manual-log", label: "Manual Log", match: (pathname: string) => pathname.startsWith("/manual-log") },
];

const mobileNavItems = [
  { href: "/", label: "Home", detail: "Dashboard", match: (pathname: string) => pathname === "/" },
  { href: "/routines", label: "Log", detail: "Routines", match: (pathname: string) => pathname.startsWith("/routines") },
  { href: "/goals", label: "Goals", detail: "Targets", match: (pathname: string) => pathname.startsWith("/goals") },
  { href: "/schedule", label: "Schedule", detail: "Planner", match: (pathname: string) => pathname.startsWith("/schedule") },
  { href: "/manual-log", label: "Account", detail: "Log History", match: (pathname: string) => pathname.startsWith("/manual-log") },
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
              aria-label={`${item.label} (${item.detail})`}
            >
              <span className="mobileBottomNavText">{item.label}</span>
              <span className="mobileBottomNavDetail">{item.detail}</span>
            </Link>
          );
      })}
    </nav>
  );
}
