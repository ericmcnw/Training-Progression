"use client";

import { LogDraftProvider } from "./contexts/LogDraftContext";
import { LogDrawerProvider } from "./contexts/LogDrawerContext";
import { FormDrawerProvider } from "./contexts/FormDrawerContext";
import { ViewLogDrawerProvider } from "./contexts/ViewLogDrawerContext";
import { EditLogDrawerProvider } from "./contexts/EditLogDrawerContext";

export default function ClientProviders({
  profileKey,
  children,
}: {
  profileKey: string;
  children: React.ReactNode;
}) {
  return (
    <LogDraftProvider profileKey={profileKey}>
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
