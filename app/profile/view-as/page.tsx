import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { getAppSession } from "@/lib/auth";
import { basePrisma } from "@/lib/prisma-base";
import { invitesConfigured, listInvitedUsers, type InvitedUser } from "@/lib/supabase/admin";
import { setClient, setInvite, startViewingAs } from "./actions";
import { backLinkStyle as sharedBackLink } from "@/lib/page-chrome";

export const dynamic = "force-dynamic";

export default async function ViewAsPage() {
  const session = await getAppSession();
  if (!session.isAdmin) notFound();

  const ownProfileKey = session.ownProfileKey ?? session.profileKey;
  const [profiles, logCounts] = await Promise.all([
    basePrisma.appProfile.findMany({
      orderBy: { createdAt: "asc" },
      select: { key: true, email: true, displayName: true, createdAt: true, managedByKey: true },
    }),
    basePrisma.routineLog.groupBy({ by: ["profileKey"], _count: { _all: true } }),
  ]);
  const logsByProfile = new Map(logCounts.map((row) => [row.profileKey, row._count._all]));

  let invited: InvitedUser[] = [];
  let inviteError: string | null = null;
  try {
    invited = await listInvitedUsers();
  } catch (error) {
    inviteError = error instanceof Error ? error.message : "Couldn't load invites.";
  }

  return (
    <div style={shell}>
      <div>
        <Link href="/profile/settings" style={backLink}>← Settings</Link>
      </div>
      <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0 }}>View another account</h1>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, opacity: 0.72 }}>
        The whole app switches to their data until you go back. Anything you log or change while viewing goes into their
        account.
      </p>

      <div style={{ display: "grid", gap: 10 }}>
        {profiles.map((profile) => {
          const isOwn = profile.key === ownProfileKey;
          const isCurrent = profile.key === session.profileKey;
          const logs = logsByProfile.get(profile.key) ?? 0;
          const isClient = profile.managedByKey === ownProfileKey;
          return (
            <div key={profile.key} style={row}>
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
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                {isOwn ? null : (
                  <form action={setClient}>
                    <input type="hidden" name="profileKey" value={profile.key} />
                    <input type="hidden" name="client" value={isClient ? "off" : "on"} />
                    <button type="submit" style={isClient ? clientOnBtn : clientBtn}>
                      {isClient ? "Client ✓" : "Add as client"}
                    </button>
                  </form>
                )}
                <form action={startViewingAs}>
                  <input type="hidden" name="profileKey" value={profile.key} />
                  <button type="submit" disabled={isCurrent} style={isCurrent ? currentBtn : viewBtn}>
                    {isCurrent ? "Viewing" : isOwn ? "Back to me" : "View as"}
                  </button>
                </form>
              </div>
            </div>
          );
        })}
      </div>

      <h2 style={{ fontSize: 17, fontWeight: 900, margin: "8px 0 0" }}>Invite someone</h2>
      {invitesConfigured() ? (
        <>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, opacity: 0.72 }}>
            An invited email can sign in at {process.env.APP_URL?.trim() || "this site"}. Nothing is sent to them, so tell
            them they are in. Their account appears above after their first sign-in.
          </p>
          <form action={setInvite} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              type="email"
              name="email"
              required
              placeholder="friend@example.com"
              autoComplete="off"
              style={emailInput}
            />
            <button type="submit" style={viewBtn}>Invite</button>
          </form>
          {inviteError ? <div style={{ ...meta, whiteSpace: "normal", color: "rgba(248,113,113,0.95)" }}>{inviteError}</div> : null}
          <div style={{ display: "grid", gap: 10 }}>
            {invited.map((user) => (
              <div key={user.id} style={row}>
                <div style={{ display: "grid", gap: 3, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis" }}>{user.email}</div>
                  <div style={meta}>{user.lastSignInAt ? "Has signed in" : "Not signed in yet"}</div>
                </div>
                <form action={setInvite}>
                  <input type="hidden" name="email" value={user.email} />
                  <input type="hidden" name="invited" value="off" />
                  <button type="submit" style={clientBtn}>Remove</button>
                </form>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, opacity: 0.72 }}>
          Add SUPABASE_SERVICE_ROLE_KEY to this deployment&apos;s environment to invite people from here. Until then,
          access is the AUTH_ALLOWED_EMAILS list.
        </p>
      )}
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

const backLink: CSSProperties = sharedBackLink;

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

// form-ui's inputStyle lives in a client module, which a server page can't
// read values from; this mirrors it.
const emailInput: CSSProperties = {
  flex: "1 1 220px",
  minWidth: 0,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(128,128,128,0.45)",
  background: "#111827",
  color: "#ffffff",
  fontSize: 16,
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

const clientBtn: CSSProperties = {
  ...viewBtn,
  border: "1px solid rgba(255,255,255,0.16)",
  background: "transparent",
  color: "inherit",
  opacity: 0.75,
};

const clientOnBtn: CSSProperties = {
  ...viewBtn,
  border: "1px solid rgba(96,165,250,0.45)",
  background: "rgba(96,165,250,0.14)",
  color: "rgba(191,219,254,0.98)",
};

const currentBtn: CSSProperties = {
  ...viewBtn,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "transparent",
  color: "inherit",
  opacity: 0.5,
  cursor: "default",
};
