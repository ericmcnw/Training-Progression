import type { Metadata, Viewport } from "next";
import Link from "next/link";
import AppNavigation, { MobileBottomNavigation, MobileProfileButton } from "./AppNavigation";
import ActiveSessionTray from "./components/ActiveSessionTray";
import LogDrawer from "./components/LogDrawer";
import FormDrawer from "./components/FormDrawer";
import ViewLogDrawer from "./components/ViewLogDrawer";
import EditLogDrawer from "./components/EditLogDrawer";
import ClientProviders from "./ClientProviders";
import "./globals.css";

export const metadata: Metadata = {
  title: "Progression",
  description: "Personal training planning, logging, and progress tracking",
};

// Standard mobile viewport. We deliberately do NOT set
// `maximumScale` / `userScalable: false` — Apple flags those as
// accessibility-hostile and may produce odd behavior near tappable
// elements. The chart no longer relies on viewport flags to avoid
// zoom; its tap targets are native HTML <button>s with
// `touch-action: manipulation`, which is the supported way to opt
// out of double-tap-zoom on iOS.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="appBody">
        <ClientProviders>
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
          <ActiveSessionTray />
          <LogDrawer />
          <ViewLogDrawer />
          <EditLogDrawer />
          <FormDrawer />
          <MobileBottomNavigation />
        </ClientProviders>
      </body>
    </html>
  );
}
