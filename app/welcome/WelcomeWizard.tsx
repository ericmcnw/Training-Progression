"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type CSSProperties } from "react";
import { Field, FormError, FormSection, FormStack, inputStyle } from "@/app/routines/[id]/log/form-ui";
import HomeLocationSetting from "@/app/profile/HomeLocationSetting";
import { setProfileIdentity } from "@/app/profile/identity-actions";
import InjuryForm from "@/app/components/injuries/InjuryForm";
import { createInjury } from "@/app/injuries/actions";
import { NewRoutineDrawerButton } from "@/app/components/FormDrawerButtons";
import type { HomeLocation } from "@/lib/home-location";
import type { ProfileIdentity } from "@/lib/profile-identity";
import { finishWelcome, saveWelcomeActivities } from "./actions";

type Tile = { slug: string; label: string; icon: string };

const STEPS = ["name", "activities", "home", "injury", "done"] as const;
type Step = (typeof STEPS)[number];

export default function WelcomeWizard({
  identity,
  homeLocation,
  endurance,
  sports,
  initialEndurance,
  initialSports,
  zones,
  factorSuggestions,
}: {
  identity: ProfileIdentity;
  homeLocation: HomeLocation | null;
  endurance: Tile[];
  sports: Tile[];
  initialEndurance: string[];
  initialSports: string[];
  zones: { slug: string; label: string }[];
  factorSuggestions: string[];
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("name");
  const [name, setName] = useState(identity.displayName ?? "");
  const [lifting, setLifting] = useState(false);
  const [mobility, setMobility] = useState(false);
  const [pickedEndurance, setPickedEndurance] = useState<string[]>(initialEndurance);
  const [pickedSports, setPickedSports] = useState<string[]>(initialSports);
  const [addingInjury, setAddingInjury] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const stepIndex = STEPS.indexOf(step);

  useEffect(() => {
    if (step === "done") void finishWelcome();
  }, [step]);

  function run(work: () => Promise<void>, next: Step) {
    setError(null);
    startTransition(async () => {
      try {
        await work();
        setStep(next);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't save that. Try again.");
      }
    });
  }

  function skipAll() {
    startTransition(async () => {
      await finishWelcome();
      router.push("/");
    });
  }

  function toggle(list: string[], setList: (v: string[]) => void, slug: string) {
    setList(list.includes(slug) ? list.filter((s) => s !== slug) : [...list, slug]);
  }

  return (
    <div style={shell}>
      <FormStack>
        <div style={topRow}>
          <div style={dots} aria-label={`Step ${stepIndex + 1} of ${STEPS.length}`}>
            {STEPS.map((s, i) => (
              <span key={s} style={{ ...dot, opacity: i <= stepIndex ? 1 : 0.25 }} />
            ))}
          </div>
          {step !== "done" ? (
            <button type="button" onClick={skipAll} disabled={pending} style={linkButton}>
              Skip setup
            </button>
          ) : null}
        </div>

        {step === "name" ? (
          <>
            <Heading title="Welcome" sub="A few quick questions so the app shows what you actually do. Everything here can be changed later in Settings." />
            <FormSection>
              <Field label="What should we call you?">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  autoComplete="given-name"
                  maxLength={40}
                  style={inputStyle}
                />
              </Field>
            </FormSection>
            <Actions
              pending={pending}
              onNext={() =>
                run(
                  () =>
                    setProfileIdentity({
                      displayName: name,
                      avatarEmoji: identity.avatarEmoji,
                      avatarColor: identity.avatarColor,
                    }),
                  "activities"
                )
              }
            />
          </>
        ) : null}

        {step === "activities" ? (
          <>
            <Heading title="What do you do?" sub="Pick everything you'd want to log. Only these show up when you log." />
            <FormSection title="Training">
              <div style={grid}>
                <TileButton tile={{ slug: "lifting", label: "Lifting", icon: "🏋️" }} on={lifting} onClick={() => setLifting(!lifting)} />
                <TileButton tile={{ slug: "mobility", label: "Mobility · rehab", icon: "🧘" }} on={mobility} onClick={() => setMobility(!mobility)} />
              </div>
            </FormSection>
            <FormSection title="Endurance">
              <div style={grid}>
                {endurance.map((t) => (
                  <TileButton key={t.slug} tile={t} on={pickedEndurance.includes(t.slug)} onClick={() => toggle(pickedEndurance, setPickedEndurance, t.slug)} />
                ))}
              </div>
            </FormSection>
            <FormSection title="Sports">
              <div style={grid}>
                {sports.map((t) => (
                  <TileButton key={t.slug} tile={t} on={pickedSports.includes(t.slug)} onClick={() => toggle(pickedSports, setPickedSports, t.slug)} />
                ))}
              </div>
            </FormSection>
            <Actions
              pending={pending}
              onBack={() => setStep("name")}
              onNext={() =>
                run(
                  () => saveWelcomeActivities({ sportSlugs: pickedSports, enduranceFamilySlugs: pickedEndurance }),
                  "home"
                )
              }
            />
          </>
        ) : null}

        {step === "home" ? (
          <>
            <Heading title="Where's home?" sub="Used for the weather on your logs and the forecast on Home. Your town is plenty." />
            <HomeLocationSetting initial={homeLocation} />
            <Actions pending={pending} onBack={() => setStep("activities")} onNext={() => setStep("injury")} />
          </>
        ) : null}

        {step === "injury" ? (
          <>
            <Heading title="Anything hurting right now?" sub="Track it here and the app keeps it next to your training, so you can see what helps and what flares it." />
            {addingInjury ? (
              <FormSection>
                <InjuryForm
                  zones={zones}
                  factorSuggestions={factorSuggestions}
                  submitLabel="Add injury"
                  action={createInjury}
                  onSaved={() => setStep("done")}
                />
              </FormSection>
            ) : (
              <div style={choiceRow}>
                <button type="button" onClick={() => setStep("done")} style={primaryButton}>
                  No, all good
                </button>
                <button type="button" onClick={() => setAddingInjury(true)} style={secondaryButton}>
                  Yes, add it
                </button>
              </div>
            )}
            <div>
              <button type="button" onClick={() => (addingInjury ? setAddingInjury(false) : setStep("home"))} style={linkButton}>
                Back
              </button>
            </div>
          </>
        ) : null}

        {step === "done" ? (
          <>
            <Heading
              title={name.trim() ? `You're set, ${name.trim()}` : "You're set"}
              sub="Start by logging something you did this week. Your history, charts and goals build from there."
            />
            <div style={{ display: "grid", gap: 10 }}>
              <Link href="/log" style={primaryButton}>
                Log something from this week
              </Link>
              {lifting ? (
                <NewRoutineDrawerButton presetDomain="strength" style={secondaryButton}>
                  Build a lifting routine
                </NewRoutineDrawerButton>
              ) : null}
              {mobility ? (
                <NewRoutineDrawerButton presetDomain="mobility" style={secondaryButton}>
                  Build a mobility routine
                </NewRoutineDrawerButton>
              ) : null}
              <Link href="/" style={secondaryButton}>
                Go to Home
              </Link>
            </div>
          </>
        ) : null}

        <FormError message={error} />
      </FormStack>
    </div>
  );
}

function Heading({ title, sub }: { title: string; sub: string }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0 }}>{title}</h1>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, opacity: 0.72 }}>{sub}</p>
    </div>
  );
}

function Actions({ pending, onNext, onBack }: { pending: boolean; onNext: () => void; onBack?: () => void }) {
  return (
    <div style={choiceRow}>
      <button type="button" onClick={onNext} disabled={pending} style={primaryButton}>
        {pending ? "Saving…" : "Next"}
      </button>
      {onBack ? (
        <button type="button" onClick={onBack} disabled={pending} style={secondaryButton}>
          Back
        </button>
      ) : null}
    </div>
  );
}

function TileButton({ tile, on, onClick }: { tile: Tile; on: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} style={on ? tileOn : tileOff}>
      <span style={{ fontSize: 22, lineHeight: 1 }}>{tile.icon}</span>
      <span style={{ fontSize: 13, fontWeight: 800 }}>{tile.label}</span>
    </button>
  );
}

const shell: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  padding: "16px 12px 40px",
};

const topRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const dots: CSSProperties = { display: "flex", gap: 6 };

const dot: CSSProperties = {
  width: 22,
  height: 5,
  borderRadius: 3,
  background: "var(--success)",
};

const grid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))",
  gap: 8,
};

const tileOff: CSSProperties = {
  display: "grid",
  justifyItems: "center",
  alignContent: "center",
  gap: 6,
  minHeight: 76,
  padding: "10px 8px",
  borderRadius: 12,
  border: "1px solid rgba(128,128,128,0.3)",
  background: "rgba(128,128,128,0.06)",
  color: "inherit",
  textAlign: "center",
  touchAction: "manipulation",
};

const tileOn: CSSProperties = {
  ...tileOff,
  border: "1px solid rgba(51,255,122,0.7)",
  background: "rgba(51,255,122,0.12)",
};

const choiceRow: CSSProperties = { display: "grid", gap: 10 };

const primaryButton: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 48,
  padding: "12px 16px",
  borderRadius: 12,
  border: "1px solid rgba(51,255,122,0.6)",
  background: "rgba(51,255,122,0.16)",
  color: "inherit",
  fontSize: 15,
  fontWeight: 900,
  textDecoration: "none",
};

const secondaryButton: CSSProperties = {
  ...primaryButton,
  border: "1px solid rgba(128,128,128,0.35)",
  background: "rgba(128,128,128,0.08)",
  fontWeight: 800,
};

const linkButton: CSSProperties = {
  minHeight: 44,
  padding: "8px 10px",
  border: "none",
  background: "transparent",
  color: "inherit",
  fontSize: 13,
  fontWeight: 700,
  opacity: 0.65,
  cursor: "pointer",
};
