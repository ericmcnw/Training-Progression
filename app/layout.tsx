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
        <header className="appHeader">
          <div className="appHeaderInner">
            <Link href="/" className="appBrand">
              Progression
            </Link>

            <nav className="appNav">
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

        <main className="appMain">{children}</main>
      </body>
    </html>
  );
}
