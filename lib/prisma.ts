import { PrismaClient } from "@/generated/prisma";

const globalForPrisma = global as unknown as { prisma?: PrismaClient };
const datasourceUrl = process.env.DATABASE_URL ?? process.env.DIRECT_URL;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl,
    log: ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
