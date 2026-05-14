-- Admin audit trail (Section 3.7 / new in 2026-05).
-- Every privileged admin action writes one row here. See
-- apps/web/lib/admin-audit.ts for the write helper.

CREATE TABLE "admin_action_logs" (
  "id"            UUID NOT NULL DEFAULT gen_random_uuid(),
  "admin_user_id" UUID NOT NULL,
  -- Machine-readable action key e.g. 'user.suspend', 'provider.review',
  -- 'service_request.status_change', 'preview.access'.
  "action"        VARCHAR(60) NOT NULL,
  -- Resource type the action targets. Nullable for global actions.
  "target_type"   VARCHAR(40),
  "target_id"     UUID,
  "summary"       VARCHAR(500) NOT NULL,
  "metadata"      JSONB NOT NULL DEFAULT '{}',
  "ip_address"    VARCHAR(64),
  "user_agent"    VARCHAR(500),
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "admin_action_logs_pkey" PRIMARY KEY ("id")
);

-- Audit history never gets silently dropped — admins are suspended, not deleted.
ALTER TABLE "admin_action_logs"
  ADD CONSTRAINT "admin_action_logs_admin_user_id_fkey"
  FOREIGN KEY ("admin_user_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Per-admin activity feed (audit page filtered by admin).
CREATE INDEX "admin_action_logs_admin_user_id_created_at_idx"
  ON "admin_action_logs" ("admin_user_id", "created_at" DESC);

-- Per-resource history (e.g. "show me everything that happened to provider X").
CREATE INDEX "admin_action_logs_target_type_target_id_created_at_idx"
  ON "admin_action_logs" ("target_type", "target_id", "created_at" DESC);

-- Global reverse-chronological browse.
CREATE INDEX "admin_action_logs_created_at_idx"
  ON "admin_action_logs" ("created_at" DESC);
