// Client-safe helpers shared by the v2 home components.
//
// IMPORTANT: this file must not import from "@/lib/prisma" or any module
// that does. Anything in here gets bundled into the client. Keep it pure.

import { domainColor } from "@/lib/routines";

export const domainAccent = domainColor;
