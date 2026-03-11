import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Progression",
  description: "Personal progression tracker",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <header style={{ borderBottom: "1px solid rgba(255,255,255,0.10)" }}>
          <div
            style={{
              maxWidth: 980,
              margin: "0 auto",
              padding: "14px 18px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
            }}
          >
            <Link href="/" style={{ fontWeight: 900, letterSpacing: 0.3 }}>
              Progression
            </Link>

            <nav
              style={{
                display: "flex",
                gap: 14,
                opacity: 0.95,
                flexWrap: "wrap",
              }}
            >
              <Link className="navLink" href="/">
                Dashboard
              </Link>
              <Link className="navLink" href="/routines">
                Routines
              </Link>
              <Link className="navLink" href="/progress">
                Progress
              </Link>
              <Link className="navLink" href="/goals">
                Goals
              </Link>
              <Link className="navLink" href="/schedule">
                Schedule
              </Link>
              <Link className="navLink" href="/manual-log">
                Manual Log
              </Link>
            </nav>
          </div>
        </header>

        <main style={{ maxWidth: 980, margin: "0 auto", padding: "18px" }}>
          {children}
        </main>
      </body>
    </html>
  );
}
