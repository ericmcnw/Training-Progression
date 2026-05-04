import Link from "next/link";
import { sendMagicLink } from "./actions";

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
            Supabase Auth
          </p>
          <h1 style={{ margin: 0, fontSize: 32, lineHeight: 1.05, fontWeight: 900 }}>Sign in to Progression</h1>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, opacity: 0.72 }}>
            Start with email magic links while the app is being upgraded to a real multi-user model.
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

        <form action={sendMagicLink} style={{ display: "grid", gap: 14 }}>
          <input type="hidden" name="next" value={next} />
          <label style={{ display: "grid", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, opacity: 0.88 }}>Email</span>
            <input
              type="email"
              name="email"
              required
              placeholder="you@example.com"
              style={{
                width: "100%",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(8,10,18,0.78)",
                color: "inherit",
                padding: "14px 16px",
                fontSize: 15,
              }}
            />
          </label>

          <button
            type="submit"
            style={{
              border: 0,
              borderRadius: 14,
              padding: "14px 16px",
              fontSize: 15,
              fontWeight: 900,
              background: "linear-gradient(135deg, #f4d35e 0%, #ee964b 100%)",
              color: "#111827",
              cursor: "pointer",
            }}
          >
            Email me a sign-in link
          </button>
        </form>

        <div style={{ fontSize: 13, lineHeight: 1.6, opacity: 0.62 }}>
          After clicking the email link you will come back here, then the session cookie will be stored server-side.
        </div>

        <Link href="/" style={{ fontSize: 13, fontWeight: 700, opacity: 0.78 }}>
          Back to app
        </Link>
      </section>
    </main>
  );
}
