-- AlterTable: users — add date_of_birth and address
ALTER TABLE "users" ADD COLUMN "date_of_birth" DATE;
ALTER TABLE "users" ADD COLUMN "address" VARCHAR(500);

-- AlterTable: recipients — add relationship and address
ALTER TABLE "recipients" ADD COLUMN "relationship" VARCHAR(20);
ALTER TABLE "recipients" ADD COLUMN "address" VARCHAR(500);

-- AlterTable: service_requests — add departure_location, destination, service_duration, metadata
ALTER TABLE "service_requests" ADD COLUMN "departure_location" VARCHAR(500);
ALTER TABLE "service_requests" ADD COLUMN "destination" VARCHAR(500);
ALTER TABLE "service_requests" ADD COLUMN "service_duration" INTEGER;
ALTER TABLE "service_requests" ADD COLUMN "metadata" JSONB NOT NULL DEFAULT '{}';
