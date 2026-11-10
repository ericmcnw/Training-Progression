// Claims an AppProfile for an email so that person's first sign-in lands on it
// instead of creating a fresh, empty profile.
//   node scripts/link-profile.mjs <email> [profileKey=default]            # dry run
//   node scripts/link-profile.mjs <email> [profileKey=default] --commit   # write
import "dotenv/config";
import { PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();
const args = process.argv.slice(2).filter((a) => a !== "--commit");
const commit = process.argv.includes("--commit");
const email = (args[0] ?? "").trim().toLowerCase();
const key = args[1] ?? "default";

if (!email.includes("@")) {
  console.error("usage: node scripts/link-profile.mjs <email> [profileKey] [--commit]");
  process.exit(1);
}

const profile = await prisma.appProfile.findUnique({ where: { key } });
const holder = await prisma.appProfile.findUnique({ where: { email } });

if (!profile) {
  console.error(`No AppProfile with key "${key}".`);
  process.exit(1);
}
if (holder && holder.id !== profile.id) {
  console.error(`${email} is already on profile "${holder.key}". Unlink it first.`);
  process.exit(1);
}

console.log(`profile "${key}": email ${profile.email ?? "(none)"} -> ${email}, authUserId ${profile.authUserId ?? "(none)"}`);

if (commit) {
  await prisma.appProfile.update({ where: { id: profile.id }, data: { email } });
  console.log("written");
} else {
  console.log("dry run — pass --commit to write");
}

await prisma.$disconnect();
