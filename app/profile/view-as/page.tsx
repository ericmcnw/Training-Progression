import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { getAppSession } from "@/lib/auth";
import { basePrisma } from "@/lib/prisma-base";
import { startViewingAs } from "./actions";

export const dynamic = "force-dynamic";

export default async function ViewAsPage() {
  const session = await getAppSession();
  if (!session.isAdmin) notFound();

  const ownProfileKey = session.ownProfileKey ?? session.profileKey;
  const [profiles, logCounts] = await Promise.all([
    basePrisma.appProfile.findMany({
      orderBy: { createdAt: "asc" },
      select: { key: true, email: true, displayName: true, createdAt: true },
    }),
    basePrisma.routineLog.groupBy({ by: ["profileKey"], _count: { _all: true } }),
  ]);
  const logsByProfile = new Map(logCounts.map((row) => [row.profileKey, row._count._all]));

  return (
    <div style={shell}>
      <div>
        <Link href="/profile/settings" style={backLink}>← Settings</Link>
      </div>
      <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>View another account</h1>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, opacity: 0.72 }}>
        The whole app switches to their data until you go back. Anything you log or change while viewing goes into their
        account.
      </p>

      <div style={{ display: "grid", gap: 10 }}>
        {profiles.map((profile) => {
          const isOwn = profile.key === ownProfileKey;
          const isCurrent = profile.key === session.profileKey;
          const logs = logsByProfile.get(profile.key) ?? 0;
          return (
            <form key={profile.key} action={startViewingAs} style={row}>
              <input type="hidden" name="profileKey" value={profile.key} />
              <div style={{ display: "grid", gap: 3, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 900 }}>
                  {profile.displayName ?? profile.email ?? profile.key}
                  {isOwn ? " (you)" : ""}
                </div>
                <div style={meta}>
                  {profile.email ?? "no email"} · {logs} {logs === 1 ? "log" : "logs"} · joined{" "}
                  {profile.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </div>
              </div>
              <button type="submit" disabled={isCurrent} style={isCurrent ? currentBtn : viewBtn}>
                {isCurrent ? "Viewing" : isOwn ? "Back to me" : "View as"}
              </button>
            </form>
          );
        })}
      </div>
    </div>
  );
}

const shell: CSSProperties = {
  maxWidth: "var(--app-width-form)",
  margin: "0 auto",
  padding: "16px 12px",
  display: "grid",
  gap: 16,
};

const backLink: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  opacity: 0.65,
  textDecoration: "none",
  color: "inherit",
  padding: "4px 10px",
  borderRadius: 8,
  border: "1px solid rgba(128,128,128,0.2)",
  background: "rgba(128,128,128,0.06)",
};

const row: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.07)",
  background: "rgba(255,255,255,0.03)",
};

const meta: CSSProperties = {
  fontSize: 11.5,
  opacity: 0.62,
  fontWeight: 600,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const viewBtn: CSSProperties = {
  padding: "9px 14px",
  borderRadius: 10,
  border: "1px solid rgba(251,191,36,0.45)",
  background: "rgba(251,191,36,0.14)",
  color: "rgba(253,230,138,0.98)",
  fontSize: 12.5,
  fontWeight: 900,
  whiteSpace: "nowrap",
  minHeight: 44,
  flexShrink: 0,
  cursor: "pointer",
};

const currentBtn: CSSProperties = {
  ...viewBtn,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "transparent",
  color: "inherit",
  opacity: 0.5,
  cursor: "default",
};
