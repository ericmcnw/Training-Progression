export function isMissingRoutineFrequencyColumnsError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  return (
    message.includes("Routine.targetFrequencyCount") ||
    message.includes("Routine.targetFrequencyUnit") ||
    message.includes("Routine.targetFrequencyInterval") ||
    message.includes("Routine.frequencyGoalEnabled")
  );
}

export function withNullRoutineFrequencyTargets<T extends object>(routine: T) {
  return {
    ...routine,
    targetFrequencyCount: null,
    targetFrequencyUnit: null,
    targetFrequencyInterval: null,
    frequencyGoalEnabled: true,
  };
}
