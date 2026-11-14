import type { Metadata, Viewport } from "next";
import Link from "next/link";
import AppNavigation, { MobileBottomNavigation } from "./AppNavigation";
import ActiveSessionTray from "./components/ActiveSessionTray";
import LogDrawer from "./components/LogDrawer";
import FormDrawer from "./components/FormDrawer";
import ViewLogDrawer from "./components/ViewLogDrawer";
import EditLogDrawer from "./components/EditLogDrawer";
import CoachWidget from "./coach/CoachWidget";
import ClientProviders from "./ClientProviders";
import ViewingAsBanner from "./ViewingAsBanner";
import { getAppSession } from "@/lib/auth";
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Log drafts live in localStorage, which is per-browser rather than per
  // account — the providers need to know whose drafts to read and write.
  const { profileKey } = await getAppSession();

  return (
    <html lang="en">
      <body className="appBody">
        <ClientProviders profileKey={profileKey}>
          <ViewingAsBanner />
          <header className="appHeader">
            <div className="appHeaderInner">
              <Link href="/" className="appBrand">
                Progression
              </Link>

              <AppNavigation />
            </div>
          </header>

          <main className="appMain">{children}</main>
          <ActiveSessionTray />
          <LogDrawer />
          <ViewLogDrawer />
          <EditLogDrawer />
          <FormDrawer />
          {/* Floating coach — global, only when the deployment is configured. */}
          {process.env.ANTHROPIC_API_KEY && process.env.COACH_SECRET ? <CoachWidget /> : null}
          <MobileBottomNavigation />
        </ClientProviders>
      </body>
    </html>
  );
}
