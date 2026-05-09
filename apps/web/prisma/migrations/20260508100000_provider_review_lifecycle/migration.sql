-- AlterTable: providers — add review lifecycle audit timestamps (Section 4.1.2).
-- submitted_at: most recent onboarding submission or reapply timestamp.
-- reviewed_at:  most recent admin review decision (approve/reject/suspend).
ALTER TABLE "providers" ADD COLUMN "submitted_at" TIMESTAMPTZ;
ALTER TABLE "providers" ADD COLUMN "reviewed_at"  TIMESTAMPTZ;

-- Backfill #1: providers already past review (approved / suspended / rejected).
-- Use created_at as best-effort proxy for submitted_at, updated_at for reviewed_at.
-- COALESCE makes the UPDATE idempotent — re-running this migration won't overwrite real values.
UPDATE "providers"
   SET "submitted_at" = COALESCE("submitted_at", "created_at"),
       "reviewed_at"  = COALESCE("reviewed_at",  "updated_at")
 WHERE "review_status" IN ('approved', 'suspended', 'rejected');

-- Backfill #2: pending providers who have already populated their profile.
-- Heuristic: non-empty specialties array OR non-null education indicates a real submission.
-- For pending providers without these fields, leave submitted_at NULL (they haven't actually
-- submitted yet — that's the new "onboarding incomplete" state Section 4.1.5 will set).
UPDATE "providers"
   SET "submitted_at" = COALESCE("submitted_at", "updated_at")
 WHERE "review_status" = 'pending'
   AND (
     ("specialties" IS NOT NULL AND jsonb_array_length("specialties") > 0)
     OR "education" IS NOT NULL
   );
