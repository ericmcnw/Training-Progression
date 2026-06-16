-- What makes an injury worse — a free-form list of factors (movements,
-- activities, exercises). Plain string array; additive.
ALTER TABLE "ActiveInjury" ADD COLUMN "aggravatingFactors" TEXT[] NOT NULL DEFAULT '{}';
