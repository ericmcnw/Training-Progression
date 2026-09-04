-- Declared repeats on a climb attempt.
--
-- Repeats were only ever inferred: from a second card on the same climb in
-- the same session, or from priorSendCount on a SAVED ClimbProblem. Neither
-- can express "I did this again" when the climb was never saved, which is
-- the common case for gym laps nobody names.
--
-- Additive and defaulted, so every existing row keeps its current meaning.

ALTER TABLE "ClimbAttempt" ADD COLUMN "isRepeat" BOOLEAN NOT NULL DEFAULT false;
