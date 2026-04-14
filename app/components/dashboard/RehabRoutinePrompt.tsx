import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function RehabRoutinePrompt() {
  const [activeInjuryCount, rehabRoutineCount] = await Promise.all([
    prisma.activeInjury.count({ where: { status: { in: ["ACTIVE", "FLARED"] } } }),
    prisma.routine.count({
      where: {
        isDeleted: false,
        metadataGroups: {
          some: { group: { kind: "ROUTINE_FOCUS", slug: { in: ["rehab", "recovery", "mobility"] } } },
        },
      },
    }),
  ]);

  if (activeInjuryCount === 0 || rehabRoutineCount > 0) return null;

  return (
    <div style={prompt}>
      <div style={{ fontWeight: 900 }}>You have active injuries. Want to add a rehab routine?</div>
      <Link href="/routines?mode=new" style={link}>
        Create routine
      </Link>
    </div>
  );
}

const prompt: React.CSSProperties = {
  border: "1px solid rgba(252,211,77,0.28)",
  borderRadius: 14,
  background: "rgba(252,211,77,0.08)",
  padding: 12,
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  alignItems: "center",
  flexWrap: "wrap",
};

const link: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 8,
  padding: "7px 10px",
  color: "inherit",
  textDecoration: "none",
  fontSize: 12,
  fontWeight: 900,
};
