-- Contract structure foundation: lifecycle states, renewal/finalization metadata,
-- contract participants, and contract-property composition.

ALTER TYPE "RentalContractStatus" ADD VALUE IF NOT EXISTS 'PENDING_SIGNATURE';
ALTER TYPE "RentalContractStatus" ADD VALUE IF NOT EXISTS 'FINALIZED';

CREATE TYPE "ContractFinalizationReason" AS ENUM (
  'MUTUAL_AGREEMENT',
  'TENANT_BREACH',
  'OWNER_DECISION',
  'OTHER'
);

ALTER TABLE "rental_contracts"
  ALTER COLUMN "propertyId" DROP NOT NULL,
  ALTER COLUMN "ownerId" DROP NOT NULL,
  ALTER COLUMN "renterId" DROP NOT NULL,
  ADD COLUMN "monthlyTotalAmount" DECIMAL(14, 2),
  ADD COLUMN "commissionBps" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "previousContractId" TEXT,
  ADD COLUMN "finalizedAt" TIMESTAMP(3),
  ADD COLUMN "finalizationReason" "ContractFinalizationReason",
  ADD COLUMN "finalizationDescription" TEXT;

ALTER TABLE "rental_contracts"
  ADD CONSTRAINT "rental_contracts_commissionBps_check"
  CHECK ("commissionBps" >= 0 AND "commissionBps" <= 10000);

ALTER TABLE "rental_contracts"
  ADD CONSTRAINT "rental_contracts_previousContractId_tenantId_fkey"
  FOREIGN KEY ("previousContractId", "tenantId") REFERENCES "rental_contracts"("id", "tenantId") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "rental_contracts"
  ADD CONSTRAINT "rental_contracts_other_finalization_description_check"
  CHECK ("finalizationReason" <> 'OTHER' OR NULLIF(BTRIM("finalizationDescription"), '') IS NOT NULL);

CREATE TABLE "contract_participants" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "contractId" TEXT NOT NULL,
  "personaId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "contract_participants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "contract_properties" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "contractId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "monthlyAmount" DECIMAL(14, 2),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "contract_properties_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "contract_participants_id_tenantId_key" ON "contract_participants"("id", "tenantId");
CREATE UNIQUE INDEX "contract_participants_tenantId_contractId_personaId_key" ON "contract_participants"("tenantId", "contractId", "personaId");
CREATE INDEX "contract_participants_tenantId_idx" ON "contract_participants"("tenantId");
CREATE INDEX "contract_participants_tenantId_contractId_idx" ON "contract_participants"("tenantId", "contractId");
CREATE INDEX "contract_participants_tenantId_personaId_idx" ON "contract_participants"("tenantId", "personaId");

CREATE UNIQUE INDEX "contract_properties_id_tenantId_key" ON "contract_properties"("id", "tenantId");
CREATE UNIQUE INDEX "contract_properties_tenantId_contractId_propertyId_key" ON "contract_properties"("tenantId", "contractId", "propertyId");
CREATE INDEX "contract_properties_tenantId_idx" ON "contract_properties"("tenantId");
CREATE INDEX "contract_properties_tenantId_contractId_idx" ON "contract_properties"("tenantId", "contractId");
CREATE INDEX "contract_properties_tenantId_propertyId_idx" ON "contract_properties"("tenantId", "propertyId");

CREATE INDEX "rental_contracts_tenantId_previousContractId_idx" ON "rental_contracts"("tenantId", "previousContractId");

ALTER TABLE "contract_participants"
  ADD CONSTRAINT "contract_participants_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "contract_participants"
  ADD CONSTRAINT "contract_participants_contractId_tenantId_fkey"
  FOREIGN KEY ("contractId", "tenantId") REFERENCES "rental_contracts"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "contract_participants"
  ADD CONSTRAINT "contract_participants_personaId_tenantId_fkey"
  FOREIGN KEY ("personaId", "tenantId") REFERENCES "personas"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "contract_properties"
  ADD CONSTRAINT "contract_properties_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "contract_properties"
  ADD CONSTRAINT "contract_properties_contractId_tenantId_fkey"
  FOREIGN KEY ("contractId", "tenantId") REFERENCES "rental_contracts"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "contract_properties"
  ADD CONSTRAINT "contract_properties_propertyId_tenantId_fkey"
  FOREIGN KEY ("propertyId", "tenantId") REFERENCES "properties"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
