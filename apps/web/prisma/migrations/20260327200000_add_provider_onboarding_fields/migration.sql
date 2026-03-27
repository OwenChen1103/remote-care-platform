-- AlterTable: providers — add onboarding and scheduling fields
ALTER TABLE "providers" ADD COLUMN "education" VARCHAR(200);
ALTER TABLE "providers" ADD COLUMN "available_services" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "providers" ADD COLUMN "available_schedule" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "providers" ADD COLUMN "schedule_note" TEXT;
