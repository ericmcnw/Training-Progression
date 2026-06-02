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

// Explicit viewport tells iOS not to auto-zoom on tap. Without
// `initial-scale=1`, Safari assumes desktop sizing and zooms in on
// tapped elements. `maximum-scale=1` blocks the implicit zoom-to-fit
// gesture; users can still resize text via system accessibility
// settings.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
