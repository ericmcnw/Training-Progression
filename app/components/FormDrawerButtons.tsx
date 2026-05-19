"use client";

import { useFormDrawer } from "@/app/contexts/FormDrawerContext";

// Lightweight click handlers for opening the floating routine/goal forms.
// Pages render these instead of <Link href="/routines/new"> etc. so the form
// shows up as an overlay sheet (mobile) / centered modal (desktop) rather
// than a hard page navigation.
//
// Each component renders a generic <button> the caller can style via
// className/style — same surface as the old Link components they replaced.

type ButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "type">;

export function NewRoutineDrawerButton({ children, ...props }: ButtonProps & { children: React.ReactNode }) {
  const { openRoutineNew } = useFormDrawer();
  return (
    <button type="button" {...props} onClick={() => openRoutineNew()}>
      {children}
    </button>
  );
}

export function EditRoutineDrawerButton({
  routineId,
  children,
  ...props
}: ButtonProps & { routineId: string; children: React.ReactNode }) {
  const { openRoutineEdit } = useFormDrawer();
  return (
    <button type="button" {...props} onClick={() => openRoutineEdit(routineId)}>
      {children}
    </button>
  );
}

export function NewGoalDrawerButton({
  prefill,
  children,
  ...props
}: ButtonProps & {
  prefill?: { goalType?: string; routineId?: string };
  children: React.ReactNode;
}) {
  const { openGoalNew } = useFormDrawer();
  return (
    <button type="button" {...props} onClick={() => openGoalNew(prefill)}>
      {children}
    </button>
  );
}

export function EditGoalDrawerButton({
  goalId,
  children,
  ...props
}: ButtonProps & { goalId: string; children: React.ReactNode }) {
  const { openGoalEdit } = useFormDrawer();
  return (
    <button type="button" {...props} onClick={() => openGoalEdit(goalId)}>
      {children}
    </button>
  );
}
