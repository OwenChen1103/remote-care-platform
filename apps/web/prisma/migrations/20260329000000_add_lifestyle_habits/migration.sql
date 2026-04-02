ALTER TABLE "recipients" ADD COLUMN IF NOT EXISTS "lifestyle_habits" JSONB NOT NULL DEFAULT '{}';
