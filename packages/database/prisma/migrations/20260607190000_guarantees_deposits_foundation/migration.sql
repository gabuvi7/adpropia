-- Guarantees and deposits foundation for contract-level safety rules.

CREATE TYPE "GuaranteeType" AS ENUM ('SALARY_RECEIPT', 'PROPERTY_BACKED', 'SURETY');
CREATE TYPE "GuaranteeState" AS ENUM ('ACTIVE', 'RELEASED', 'EXPIRED');

CREATE TABLE "guarantees" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "contractId" TEXT NOT NULL,
  "type" "GuaranteeType" NOT NULL,
  "state" "GuaranteeState" NOT NULL DEFAULT 'ACTIVE',
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "guarantees_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "guarantee_salary_receipts" (
  "id" TEXT NOT NULL,
  "guaranteeId" TEXT NOT NULL,
  "employerName" TEXT NOT NULL,
  "employeeName" TEXT NOT NULL,
  "employeeTaxId" TEXT,
  "monthlyIncome" DECIMAL(14,2),
  "employmentDate" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "guarantee_salary_receipts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "guarantee_property_backeds" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "guaranteeId" TEXT NOT NULL,
  "cadastralNomenclature" TEXT NOT NULL,
  "registrationNumber" TEXT NOT NULL,
  "registrationLocality" TEXT NOT NULL,
  "propertyAddress" TEXT NOT NULL,
  "propertyCity" TEXT,
  "propertyProvince" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "guarantee_property_backeds_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "guarantee_title_holders" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "guaranteePropertyBackedId" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "taxId" TEXT,
  "signsGuarantee" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "guarantee_title_holders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "guarantee_sureties" (
  "id" TEXT NOT NULL,
  "guaranteeId" TEXT NOT NULL,
  "companyName" TEXT NOT NULL,
  "policyNumber" TEXT NOT NULL,
  "contactName" TEXT,
  "contactEmail" TEXT,
  "contactPhone" TEXT,
  "coverageAmount" DECIMAL(14,2),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "guarantee_sureties_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "deposit_pacts" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "contractId" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "currency" "Currency" NOT NULL DEFAULT 'ARS',
  "receivedAt" TIMESTAMP(3),
  "notes" TEXT,
  "cashMovementId" TEXT,
  "refundCashMovementId" TEXT,
  "retentionCashMovementId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "deposit_pacts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "guarantees_id_tenantId_key" ON "guarantees"("id", "tenantId");
CREATE INDEX "guarantees_tenantId_idx" ON "guarantees"("tenantId");
CREATE INDEX "guarantees_tenantId_contractId_idx" ON "guarantees"("tenantId", "contractId");
CREATE INDEX "guarantees_tenantId_contractId_state_idx" ON "guarantees"("tenantId", "contractId", "state");

CREATE UNIQUE INDEX "guarantee_salary_receipts_guaranteeId_key" ON "guarantee_salary_receipts"("guaranteeId");

CREATE UNIQUE INDEX "guarantee_property_backeds_id_tenantId_key" ON "guarantee_property_backeds"("id", "tenantId");
CREATE UNIQUE INDEX "guarantee_property_backeds_guaranteeId_key" ON "guarantee_property_backeds"("guaranteeId");
CREATE INDEX "guarantee_property_backeds_tenantId_idx" ON "guarantee_property_backeds"("tenantId");
CREATE INDEX "guarantee_property_backeds_tenantId_guaranteeId_idx" ON "guarantee_property_backeds"("tenantId", "guaranteeId");

CREATE UNIQUE INDEX "guarantee_title_holders_id_tenantId_key" ON "guarantee_title_holders"("id", "tenantId");
CREATE INDEX "guarantee_title_holders_tenantId_idx" ON "guarantee_title_holders"("tenantId");
CREATE INDEX "guarantee_title_holders_tenantId_guaranteePropertyBackedId_idx" ON "guarantee_title_holders"("tenantId", "guaranteePropertyBackedId");

CREATE UNIQUE INDEX "guarantee_sureties_guaranteeId_key" ON "guarantee_sureties"("guaranteeId");

CREATE UNIQUE INDEX "deposit_pacts_id_tenantId_key" ON "deposit_pacts"("id", "tenantId");
CREATE UNIQUE INDEX "deposit_pacts_contractId_tenantId_key" ON "deposit_pacts"("contractId", "tenantId");
CREATE UNIQUE INDEX "deposit_pacts_tenantId_contractId_key" ON "deposit_pacts"("tenantId", "contractId");
CREATE INDEX "deposit_pacts_tenantId_idx" ON "deposit_pacts"("tenantId");
CREATE INDEX "deposit_pacts_tenantId_contractId_idx" ON "deposit_pacts"("tenantId", "contractId");

ALTER TABLE "guarantees" ADD CONSTRAINT "guarantees_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "guarantees" ADD CONSTRAINT "guarantees_contractId_tenantId_fkey" FOREIGN KEY ("contractId", "tenantId") REFERENCES "rental_contracts"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "guarantee_salary_receipts" ADD CONSTRAINT "guarantee_salary_receipts_guaranteeId_fkey" FOREIGN KEY ("guaranteeId") REFERENCES "guarantees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "guarantee_property_backeds" ADD CONSTRAINT "guarantee_property_backeds_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "guarantee_property_backeds" ADD CONSTRAINT "guarantee_property_backeds_guaranteeId_fkey" FOREIGN KEY ("guaranteeId") REFERENCES "guarantees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "guarantee_title_holders" ADD CONSTRAINT "guarantee_title_holders_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "guarantee_title_holders" ADD CONSTRAINT "guarantee_title_holders_guaranteePropertyBackedId_tenantId_fkey" FOREIGN KEY ("guaranteePropertyBackedId", "tenantId") REFERENCES "guarantee_property_backeds"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "guarantee_sureties" ADD CONSTRAINT "guarantee_sureties_guaranteeId_fkey" FOREIGN KEY ("guaranteeId") REFERENCES "guarantees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "deposit_pacts" ADD CONSTRAINT "deposit_pacts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "deposit_pacts" ADD CONSTRAINT "deposit_pacts_contractId_tenantId_fkey" FOREIGN KEY ("contractId", "tenantId") REFERENCES "rental_contracts"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;
