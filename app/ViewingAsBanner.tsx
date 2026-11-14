import Link from "next/link";
import type { CSSProperties } from "react";
import { startViewingAs, stopViewingAs } from "@/app/profile/view-as/actions";
import { getAppSession } from "@/lib/auth";
import { basePrisma } from "@/lib/prisma-base";

export default async function ViewingAsBanner() {
  const session = await getAppSession();
  if (!session.ownProfileKey) return null;

  const [profile, otherClients] = await Promise.all([
    basePrisma.appProfile.findUnique({
      where: { key: session.profileKey },
      select: { displayName: true, email: true },
    }),
    basePrisma.appProfile.findMany({
      where: { managedByKey: session.ownProfileKey, key: { not: session.profileKey } },
      orderBy: { createdAt: "asc" },
      select: { key: true, displayName: true, email: true },
    }),
  ]);
  const name = profile?.displayName ?? profile?.email ?? session.profileKey;

  return (
    <div style={banner} role="status">
      <span style={{ minWidth: 0 }}>
        Viewing as <strong>{name}</strong>. Anything you log goes into their account.{" "}
        <Link href="/profile/view-as" style={{ color: "inherit", fontWeight: 800 }}>
          Switch
        </Link>
      </span>
      <div style={actions}>
        {otherClients.map((client) => (
          <form key={client.key} action={startViewingAs}>
            <input type="hidden" name="profileKey" value={client.key} />
            <button type="submit" style={switchBtn} title={`Switch to ${client.displayName ?? client.email ?? client.key}`}>
              {shortName(client.displayName ?? client.email ?? client.key)}
            </button>
          </form>
        ))}
        <form action={stopViewingAs}>
          <button type="submit" style={backBtn}>
            Back to me
          </button>
        </form>
      </div>
    </div>
  );
}

function shortName(name: string) {
  return name.split("@")[0];
}

const actions: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  flexShrink: 0,
};

const banner: CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 1000,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "8px 14px",
  background: "#b45309",
  color: "#fff7ed",
  fontSize: 13,
  lineHeight: 1.35,
};

const switchBtn: CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.3)",
  background: "transparent",
  color: "inherit",
  fontSize: 13,
  fontWeight: 800,
  whiteSpace: "nowrap",
  maxWidth: 140,
  overflow: "hidden",
  textOverflow: "ellipsis",
  minHeight: 44,
  cursor: "pointer",
};

const backBtn: CSSProperties = {
  padding: "8px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.5)",
  background: "rgba(0,0,0,0.18)",
  color: "inherit",
  fontSize: 13,
  fontWeight: 900,
  whiteSpace: "nowrap",
  minHeight: 44,
  cursor: "pointer",
};
