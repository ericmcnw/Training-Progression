"use client";

import { LogDraftProvider } from "./contexts/LogDraftContext";
import { LogDrawerProvider } from "./contexts/LogDrawerContext";
import { FormDrawerProvider } from "./contexts/FormDrawerContext";
import { ViewLogDrawerProvider } from "./contexts/ViewLogDrawerContext";

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <LogDraftProvider>
      <LogDrawerProvider>
        <ViewLogDrawerProvider>
          <FormDrawerProvider>{children}</FormDrawerProvider>
        </ViewLogDrawerProvider>
      </LogDrawerProvider>
    </LogDraftProvider>
  );
}
