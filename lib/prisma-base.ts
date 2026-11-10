import { PrismaClient } from "@/generated/prisma";

const globalForPrisma = global as unknown as { basePrisma?: PrismaClient };
const datasourceUrl = process.env.DATABASE_URL ?? process.env.DIRECT_URL;

// Unscoped client. Only for code that must see across profiles (session →
// profile resolution); everything else imports the scoped `prisma`.
export const basePrisma =
  globalForPrisma.basePrisma ??
  new PrismaClient({
    datasourceUrl,
    log: ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.basePrisma = basePrisma;
}
