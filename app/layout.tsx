import type { Metadata } from "next";
import Link from "next/link";
import AppNavigation, { MobileBottomNavigation } from "./AppNavigation";
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

            <AppNavigation />
          </div>
        </header>

        <main className="appMain">{children}</main>
        <MobileBottomNavigation />
      </body>
    </html>
  );
}
