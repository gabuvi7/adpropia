-- Unit 6: index adjustments foundation.
-- Additive only; generated for validation and not applied to Supabase/live DB in this phase.

CREATE TYPE "ContractAdjustmentState" AS ENUM ('PENDING_RECONCILIATION', 'RECONCILED');

ALTER TABLE "custom_index_values"
  ADD COLUMN "source" TEXT,
  ADD COLUMN "publishedAt" TIMESTAMP(3),
  ADD COLUMN "idempotencyKey" TEXT;

CREATE TABLE "contract_adjustments" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "contractId" TEXT NOT NULL,
  "rentPeriodId" TEXT NOT NULL,
  "economicIndexValueId" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "type" "EconomicIndexType" NOT NULL,
  "frequencyMonths" INTEGER,
  "state" "ContractAdjustmentState" NOT NULL DEFAULT 'PENDING_RECONCILIATION',
  "estimatedAmount" DECIMAL(14,2) NOT NULL,
  "estimatedIndexValue" DECIMAL(18,6),
  "estimatedIndexSource" TEXT,
  "realIndexValue" DECIMAL(18,6) NOT NULL,
  "realAmount" DECIMAL(14,2),
  "differenceAmount" DECIMAL(14,2),
  "reconciledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "contract_adjustments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "custom_index_values_tenantId_idempotencyKey_key"
  ON "custom_index_values"("tenantId", "idempotencyKey");

CREATE INDEX "custom_index_values_source_idx" ON "custom_index_values"("source");

CREATE UNIQUE INDEX "contract_adjustments_id_tenantId_key" ON "contract_adjustments"("id", "tenantId");
CREATE UNIQUE INDEX "contract_adjustments_tenantId_rentPeriodId_economicIndexValueId_key"
  ON "contract_adjustments"("tenantId", "rentPeriodId", "economicIndexValueId");
CREATE INDEX "contract_adjustments_tenantId_idx" ON "contract_adjustments"("tenantId");
CREATE INDEX "contract_adjustments_tenantId_contractId_idx" ON "contract_adjustments"("tenantId", "contractId");
CREATE INDEX "contract_adjustments_tenantId_rentPeriodId_idx" ON "contract_adjustments"("tenantId", "rentPeriodId");
CREATE INDEX "contract_adjustments_tenantId_state_idx" ON "contract_adjustments"("tenantId", "state");

ALTER TABLE "contract_adjustments"
  ADD CONSTRAINT "contract_adjustments_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "contract_adjustments"
  ADD CONSTRAINT "contract_adjustments_contractId_tenantId_fkey"
  FOREIGN KEY ("contractId", "tenantId") REFERENCES "rental_contracts"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "contract_adjustments"
  ADD CONSTRAINT "contract_adjustments_rentPeriodId_tenantId_fkey"
  FOREIGN KEY ("rentPeriodId", "tenantId") REFERENCES "rent_periods"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "contract_adjustments"
  ADD CONSTRAINT "contract_adjustments_economicIndexValueId_tenantId_fkey"
  FOREIGN KEY ("economicIndexValueId", "tenantId") REFERENCES "custom_index_values"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
