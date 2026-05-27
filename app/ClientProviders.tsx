"use client";

import { LogDraftProvider } from "./contexts/LogDraftContext";
import { LogDrawerProvider } from "./contexts/LogDrawerContext";
import { FormDrawerProvider } from "./contexts/FormDrawerContext";
import { ViewLogDrawerProvider } from "./contexts/ViewLogDrawerContext";
import { EditLogDrawerProvider } from "./contexts/EditLogDrawerContext";

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <LogDraftProvider>
      <LogDrawerProvider>
        <ViewLogDrawerProvider>
          <EditLogDrawerProvider>
            <FormDrawerProvider>{children}</FormDrawerProvider>
          </EditLogDrawerProvider>
        </ViewLogDrawerProvider>
      </LogDrawerProvider>
    </LogDraftProvider>
  );
}
