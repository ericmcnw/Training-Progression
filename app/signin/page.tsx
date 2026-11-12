import Link from "next/link";
import type { CSSProperties } from "react";
import { enterCode, sendMagicLink, verifyCode } from "./actions";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function readFirst(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeNext(value: string | undefined) {
  const next = (value ?? "").trim();
  if (!next.startsWith("/")) return "/";
  if (next.startsWith("//")) return "/";
  return next;
}

export default async function SignInPage(props: { searchParams?: SearchParams }) {
  const searchParams = props.searchParams ? await props.searchParams : {};
  const next = normalizeNext(readFirst(searchParams.next));
  const error = readFirst(searchParams.error);
  const message = readFirst(searchParams.message);
  const sentTo = readFirst(searchParams.sent);

  return (
    <main
      style={{
        minHeight: "calc(100vh - 120px)",
        display: "grid",
        placeItems: "center",
        padding: "32px 20px",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 440,
          border: "1px solid rgba(255,255,255,0.1)",
          background: "rgba(255,255,255,0.04)",
          borderRadius: 24,
          padding: 28,
          boxShadow: "0 24px 80px rgba(0,0,0,0.28)",
          display: "grid",
          gap: 18,
        }}
      >
        <div style={{ display: "grid", gap: 8 }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 900, letterSpacing: "0.18em", textTransform: "uppercase", opacity: 0.55 }}>
            Progression
          </p>
          <h1 style={{ margin: 0, fontSize: 32, lineHeight: 1.05, fontWeight: 900 }}>
            {sentTo ? "Check your email" : "Sign in"}
          </h1>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, opacity: 0.72 }}>
            {sentTo
              ? `We sent a sign-in email to ${sentTo}. Tap the link in it, or enter the code here.`
              : "Enter your email and we'll send you a sign-in link and code. No password needed."}
          </p>
        </div>

        {error ? (
          <div style={{ borderRadius: 16, padding: "12px 14px", background: "rgba(220,38,38,0.14)", border: "1px solid rgba(248,113,113,0.35)", fontSize: 14 }}>
            {error}
          </div>
        ) : null}

        {message ? (
          <div style={{ borderRadius: 16, padding: "12px 14px", background: "rgba(34,197,94,0.12)", border: "1px solid rgba(74,222,128,0.28)", fontSize: 14 }}>
            {message}
          </div>
        ) : null}

        {sentTo ? (
          <form action={verifyCode} style={{ display: "grid", gap: 14 }}>
            <input type="hidden" name="next" value={next} />
            <input type="hidden" name="email" value={sentTo} />
            <label style={{ display: "grid", gap: 8 }}>
              <span style={labelStyle}>Code</span>
              <input
                type="text"
                name="code"
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                style={{ ...inputStyle, letterSpacing: "0.3em", textAlign: "center" }}
              />
            </label>
            <button type="submit" style={buttonStyle}>
              Sign in
            </button>
          </form>
        ) : (
          <form action={sendMagicLink} style={{ display: "grid", gap: 14 }}>
            <input type="hidden" name="next" value={next} />
            <label style={{ display: "grid", gap: 8 }}>
              <span style={labelStyle}>Email</span>
              <input type="email" name="email" required autoComplete="email" placeholder="you@example.com" style={inputStyle} />
            </label>
            <button type="submit" style={buttonStyle}>
              Email me a sign-in link
            </button>
            <button type="submit" formAction={enterCode} formNoValidate style={secondaryButtonStyle}>
              I already have a code
            </button>
          </form>
        )}

        {sentTo ? (
          <Link href={`/signin?next=${encodeURIComponent(next)}`} style={{ fontSize: 13, fontWeight: 700, opacity: 0.78 }}>
            Use a different email or send again
          </Link>
        ) : null}
      </section>
    </main>
  );
}

const labelStyle: CSSProperties = { fontSize: 13, fontWeight: 700, opacity: 0.88 };

const inputStyle: CSSProperties = {
  width: "100%",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(8,10,18,0.78)",
  color: "inherit",
  padding: "14px 16px",
  fontSize: 16,
};

const buttonStyle: CSSProperties = {
  border: 0,
  borderRadius: 14,
  padding: "14px 16px",
  minHeight: 44,
  fontSize: 15,
  fontWeight: 900,
  background: "linear-gradient(135deg, #f4d35e 0%, #ee964b 100%)",
  color: "#111827",
  cursor: "pointer",
};

const secondaryButtonStyle: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.16)",
  borderRadius: 14,
  padding: "12px 16px",
  minHeight: 44,
  fontSize: 14,
  fontWeight: 700,
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
};
