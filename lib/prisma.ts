import path from "node:path";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma?: PrismaClient };
const queryEnginePath = path.join(process.cwd(), "node_modules", ".prisma", "client", "query_engine-windows.dll.node");
const sqlitePath = path.join(process.cwd(), "prisma", "dev.db").replace(/\\/g, "/");
const prismaOptions = {
  log: ["error"],
  datasourceUrl: `file:${sqlitePath}`,
  __internal: {
    // Force the local library engine. The current generated client was built
    // without an embedded engine config, which incorrectly routes SQLite
    // projects toward Prisma Accelerate/Data Proxy validation.
    configOverride: (config: { copyEngine?: boolean }) => ({ ...config, copyEngine: true }),
    engine: {
      binaryPath: queryEnginePath,
    },
  },
} as ConstructorParameters<typeof PrismaClient>[0];

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient(prismaOptions);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
