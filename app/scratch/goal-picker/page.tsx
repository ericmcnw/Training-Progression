// THROWAWAY PROTOTYPE ROUTE — /scratch/goal-picker
// Delete the whole app/scratch/goal-picker folder once the goal-form
// redesign direction is decided. Not linked from anywhere.

import GoalPickerPrototype from "./GoalPickerPrototype";

export const metadata = { title: "Goal picker prototype" };

export default function Page() {
  return (
    <main style={{ minHeight: "100dvh", padding: "24px 0" }}>
      <GoalPickerPrototype />
    </main>
  );
}
