import type { Metadata } from "next";
import Link from "next/link";
import AppNavigation, { MobileBottomNavigation, MobileProfileButton } from "./AppNavigation";
import "./globals.css";

export const metadata: Metadata = {
  title: "Progression",
  description: "Personal training planning, logging, and progress tracking",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="appBody">
        <header className="appHeader">
          <div className="appHeaderInner">
            <Link href="/" className="appBrand">
              Progression
            </Link>

            <AppNavigation />
            <MobileProfileButton />
          </div>
        </header>

        <main className="appMain">{children}</main>
        <MobileBottomNavigation />
      </body>
    </html>
  );
}
