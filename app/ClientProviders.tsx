"use client";

import { LogDraftProvider } from "./contexts/LogDraftContext";
import { LogDrawerProvider } from "./contexts/LogDrawerContext";

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <LogDraftProvider>
      <LogDrawerProvider>{children}</LogDrawerProvider>
    </LogDraftProvider>
  );
}
