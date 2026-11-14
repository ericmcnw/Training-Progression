import type { CSSProperties } from "react";
import CollapsibleSection from "./CollapsibleSection";
import { COLOR, RADIUS } from "./tokens";
import { startViewingAs } from "@/app/profile/view-as/actions";
import { addDaysYmd } from "@/lib/dates";
import type { HomeClient } from "./clients-data";

const WEEKDAY = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" });
const SHORT_DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

function asDate(ymd: string) {
  return new Date(`${ymd}T00:00:00.000Z`);
}

function dayLabel(ymd: string, today: string) {
  if (ymd === today) return "today";
  if (ymd === addDaysYmd(today, 1)) return "tomorrow";
  return WEEKDAY.format(asDate(ymd));
}

function lastLoggedLabel(ymd: string | null, today: string) {
  if (!ymd) return "nothing logged yet";
  if (ymd === today) return "logged today";
  if (ymd === addDaysYmd(today, -1)) return "logged yesterday";
  const days = Math.round((asDate(today).getTime() - asDate(ymd).getTime()) / 86_400_000);
  return days < 7 ? `logged ${days}d ago` : `last logged ${SHORT_DATE.format(asDate(ymd))}`;
}

export default function HomeClientsSection({ clients, today }: { clients: HomeClient[]; today: string }) {
  if (clients.length === 0) return null;
  return (
    <CollapsibleSection title="Clients" count={clients.length} countTone="accent" storageKey="home.clients.open">
      <div style={list}>
        {clients.map((client) => {
          const stale = !client.lastLogYmd || client.lastLogYmd < addDaysYmd(today, -6);
          return (
            <form key={client.key} action={startViewingAs} style={row}>
              <input type="hidden" name="profileKey" value={client.key} />
              <div style={avatar} aria-hidden>{client.name.slice(0, 1).toUpperCase()}</div>
              <div style={body}>
                <div style={name}>{client.name}</div>
                {client.setupPending ? (
                  <div style={meta}>Hasn&apos;t finished setup</div>
                ) : (
                  <>
                    <div style={meta}>
                      <strong style={strong}>{client.weekLogged}</strong>
                      {client.weekScheduled > 0 ? ` of ${client.weekScheduled}` : ""} this week
                      {client.next ? ` · next ${dayLabel(client.next.ymd, today)}: ${client.next.label}` : " · nothing scheduled"}
                    </div>
                    {client.programs.length > 0 ? (
                      <div style={meta}>
                        {client.programs.map((p) => (p.phase ? `${p.name} · ${p.phase}` : p.name)).join("  /  ")}
                      </div>
                    ) : null}
                    <div style={{ ...meta, color: stale ? COLOR.amber : COLOR.textFaint }}>
                      {lastLoggedLabel(client.lastLogYmd, today)}
                    </div>
                  </>
                )}
              </div>
              <button type="submit" style={openBtn}>Open</button>
            </form>
          );
        })}
      </div>
    </CollapsibleSection>
  );
}

const list: CSSProperties = { display: "grid", gap: 8 };

const row: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "32px minmax(0, 1fr) auto",
  alignItems: "center",
  gap: 10,
  padding: "8px 10px",
  borderRadius: RADIUS.inner,
  border: `1px solid ${COLOR.border}`,
  background: COLOR.panelSoft,
};

const avatar: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: RADIUS.pill,
  display: "grid",
  placeItems: "center",
  fontSize: 14,
  fontWeight: 900,
  color: COLOR.blueText,
  background: COLOR.blueSoft,
};

const body: CSSProperties = { display: "grid", gap: 2, minWidth: 0 };

const name: CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  color: COLOR.text,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const meta: CSSProperties = {
  fontSize: 11.5,
  fontWeight: 700,
  color: COLOR.textDim,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const strong: CSSProperties = { color: COLOR.text, fontWeight: 900 };

const openBtn: CSSProperties = {
  minHeight: 44,
  padding: "6px 16px",
  borderRadius: RADIUS.pill,
  border: `1px solid ${COLOR.borderStrong}`,
  background: "rgba(255,255,255,0.06)",
  color: COLOR.text,
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
  whiteSpace: "nowrap",
};
