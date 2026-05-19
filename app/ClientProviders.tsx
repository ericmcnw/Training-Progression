"use client";

import { LogDraftProvider } from "./contexts/LogDraftContext";
import { LogDrawerProvider } from "./contexts/LogDrawerContext";
import { FormDrawerProvider } from "./contexts/FormDrawerContext";

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <LogDraftProvider>
      <LogDrawerProvider>
        <FormDrawerProvider>{children}</FormDrawerProvider>
      </LogDrawerProvider>
    </LogDraftProvider>
  );
}
