-- AlterTable: service_requests — add provider_report JSON for structured service completion data
ALTER TABLE "service_requests" ADD COLUMN "provider_report" JSONB;
