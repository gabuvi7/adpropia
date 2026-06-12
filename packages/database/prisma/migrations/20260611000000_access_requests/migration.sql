CREATE TYPE "AccessPlan" AS ENUM ('INICIAL', 'PROFESIONAL', 'OPERATIVO', 'A_MEDIDA');

CREATE TYPE "AccessRequestModule" AS ENUM (
  'RENTALS_AND_CONTRACTS',
  'INDEXES_AND_ADJUSTMENTS',
  'COLLECTIONS_PAYMENTS_CASH',
  'OWNER_LIQUIDATIONS',
  'REPORTS_AND_AUDIT',
  'SALE_UNIT_MANAGEMENT',
  'AUTOMATIONS_AND_REMINDERS'
);

CREATE TYPE "AccessRequestStatus" AS ENUM ('RECEIVED', 'REVIEWED', 'DISCARDED');

CREATE TABLE "access_requests" (
  "id" TEXT NOT NULL,
  "companyName" TEXT NOT NULL,
  "contactName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "rentalAdministrationUnits" INTEGER NOT NULL,
  "saleUnits" INTEGER NOT NULL,
  "users" INTEGER NOT NULL,
  "selectedModules" "AccessRequestModule"[] NOT NULL,
  "recommendedPlan" "AccessPlan" NOT NULL,
  "status" "AccessRequestStatus" NOT NULL DEFAULT 'RECEIVED',
  "turnstileChallengeTs" TIMESTAMP(3),
  "turnstileHostname" TEXT,
  "notificationSentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "access_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "access_requests_email_idx" ON "access_requests"("email");
CREATE INDEX "access_requests_status_createdAt_idx" ON "access_requests"("status", "createdAt");
