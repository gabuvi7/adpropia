-- Rent schedule, payment events, and tenant balance movement foundation.

CREATE TYPE "RentPeriodCalculationState" AS ENUM ('ESTIMATED', 'RECONCILED');
CREATE TYPE "RentPaymentType" AS ENUM ('ON_ACCOUNT', 'FINAL', 'BALANCE_ADJUSTMENT');
CREATE TYPE "TenantBalanceMovementType" AS ENUM ('CREDIT', 'DEBT');

CREATE TABLE "rent_periods" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "contractId" TEXT NOT NULL,
  "tenantPersonaId" TEXT,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "dueAt" TIMESTAMP(3) NOT NULL,
  "currency" "Currency" NOT NULL DEFAULT 'ARS',
  "calculationState" "RentPeriodCalculationState" NOT NULL DEFAULT 'ESTIMATED',
  "estimatedAmount" DECIMAL(14,2) NOT NULL,
  "realAmount" DECIMAL(14,2),
  "estimatedIndexType" "EconomicIndexType",
  "estimatedIndexValue" DECIMAL(18,6),
  "estimatedIndexSource" TEXT,
  "realIndexValue" DECIMAL(18,6),
  "realIndexSource" TEXT,
  "reconciledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "rent_periods_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "rent_payments" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "rentPeriodId" TEXT NOT NULL,
  "type" "RentPaymentType" NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "currency" "Currency" NOT NULL DEFAULT 'ARS',
  "paidAt" TIMESTAMP(3) NOT NULL,
  "cashMovementId" TEXT,
  "commissionMovementId" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "rent_payments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tenant_balance_movements" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "tenantPersonaId" TEXT NOT NULL,
  "rentPeriodId" TEXT NOT NULL,
  "type" "TenantBalanceMovementType" NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL,
  "currency" "Currency" NOT NULL DEFAULT 'ARS',
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "tenant_balance_movements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "rent_periods_id_tenantId_key" ON "rent_periods"("id", "tenantId");
CREATE UNIQUE INDEX "rent_periods_tenantId_contractId_periodStart_key" ON "rent_periods"("tenantId", "contractId", "periodStart");
CREATE INDEX "rent_periods_tenantId_idx" ON "rent_periods"("tenantId");
CREATE INDEX "rent_periods_tenantId_contractId_idx" ON "rent_periods"("tenantId", "contractId");
CREATE INDEX "rent_periods_tenantId_tenantPersonaId_idx" ON "rent_periods"("tenantId", "tenantPersonaId");
CREATE INDEX "rent_periods_tenantId_calculationState_idx" ON "rent_periods"("tenantId", "calculationState");

CREATE UNIQUE INDEX "rent_payments_id_tenantId_key" ON "rent_payments"("id", "tenantId");
CREATE INDEX "rent_payments_tenantId_idx" ON "rent_payments"("tenantId");
CREATE INDEX "rent_payments_tenantId_rentPeriodId_idx" ON "rent_payments"("tenantId", "rentPeriodId");
CREATE INDEX "rent_payments_tenantId_paidAt_idx" ON "rent_payments"("tenantId", "paidAt");

CREATE UNIQUE INDEX "tenant_balance_movements_id_tenantId_key" ON "tenant_balance_movements"("id", "tenantId");
CREATE INDEX "tenant_balance_movements_tenantId_idx" ON "tenant_balance_movements"("tenantId");
CREATE INDEX "tenant_balance_movements_tenantId_tenantPersonaId_idx" ON "tenant_balance_movements"("tenantId", "tenantPersonaId");
CREATE INDEX "tenant_balance_movements_tenantId_rentPeriodId_idx" ON "tenant_balance_movements"("tenantId", "rentPeriodId");

ALTER TABLE "rent_periods" ADD CONSTRAINT "rent_periods_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rent_periods" ADD CONSTRAINT "rent_periods_contractId_tenantId_fkey" FOREIGN KEY ("contractId", "tenantId") REFERENCES "rental_contracts"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rent_periods" ADD CONSTRAINT "rent_periods_tenantPersonaId_tenantId_fkey" FOREIGN KEY ("tenantPersonaId", "tenantId") REFERENCES "personas"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "rent_payments" ADD CONSTRAINT "rent_payments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rent_payments" ADD CONSTRAINT "rent_payments_rentPeriodId_tenantId_fkey" FOREIGN KEY ("rentPeriodId", "tenantId") REFERENCES "rent_periods"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tenant_balance_movements" ADD CONSTRAINT "tenant_balance_movements_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tenant_balance_movements" ADD CONSTRAINT "tenant_balance_movements_tenantPersonaId_tenantId_fkey" FOREIGN KEY ("tenantPersonaId", "tenantId") REFERENCES "personas"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tenant_balance_movements" ADD CONSTRAINT "tenant_balance_movements_rentPeriodId_tenantId_fkey" FOREIGN KEY ("rentPeriodId", "tenantId") REFERENCES "rent_periods"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;
