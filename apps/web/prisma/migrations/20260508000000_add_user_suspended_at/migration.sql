-- AlterTable: users — add suspended_at for admin user suspension (Section 3 / Decision G).
-- NULL = active; non-NULL timestamp = suspended (verifyAuth blocks login).
-- Aligns with existing soft-delete pattern (recipients.deleted_at, providers.deleted_at).
ALTER TABLE "users" ADD COLUMN "suspended_at" TIMESTAMPTZ;

-- Partial index — only stores rows where suspended_at IS NOT NULL.
-- Active users (the dominant majority) aren't indexed, keeping the index tiny.
-- Used by `GET /api/v1/admin/users?suspended=true` admin filter.
CREATE INDEX "users_suspended_at_idx" ON "users" ("suspended_at") WHERE "suspended_at" IS NOT NULL;
