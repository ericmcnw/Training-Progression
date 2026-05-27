import type { Metadata } from "next";
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
