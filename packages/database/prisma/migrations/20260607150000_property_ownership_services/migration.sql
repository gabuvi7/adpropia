-- Property ownership and services foundation for Persona-based rental units.

CREATE TABLE "property_type_catalogs" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "property_type_catalogs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "service_types" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "service_types_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "properties"
  ADD COLUMN "propertyTypeId" TEXT,
  ADD COLUMN "buildingName" TEXT;

ALTER TABLE "properties"
  ALTER COLUMN "ownerId" DROP NOT NULL;

CREATE TABLE "property_owners" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "personaId" TEXT NOT NULL,
  "ownershipShareBps" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "property_owners_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "property_owners_ownership_share_range" CHECK ("ownershipShareBps" > 0 AND "ownershipShareBps" <= 10000)
);

COMMENT ON COLUMN "property_owners"."ownershipShareBps" IS 'Ownership share in basis points; 100% = 10,000 bps.';

CREATE TABLE "property_services" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "serviceTypeId" TEXT NOT NULL,
  "accountNumber" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "property_services_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "property_type_catalogs_code_key" ON "property_type_catalogs"("code");
CREATE UNIQUE INDEX "service_types_code_key" ON "service_types"("code");

CREATE UNIQUE INDEX "property_owners_id_tenantId_key" ON "property_owners"("id", "tenantId");
CREATE UNIQUE INDEX "property_owners_tenantId_propertyId_personaId_key" ON "property_owners"("tenantId", "propertyId", "personaId");
CREATE INDEX "property_owners_tenantId_idx" ON "property_owners"("tenantId");
CREATE INDEX "property_owners_tenantId_propertyId_idx" ON "property_owners"("tenantId", "propertyId");
CREATE INDEX "property_owners_tenantId_personaId_idx" ON "property_owners"("tenantId", "personaId");

CREATE UNIQUE INDEX "property_services_id_tenantId_key" ON "property_services"("id", "tenantId");
CREATE UNIQUE INDEX "property_services_tenantId_propertyId_serviceTypeId_key" ON "property_services"("tenantId", "propertyId", "serviceTypeId");
CREATE INDEX "property_services_tenantId_idx" ON "property_services"("tenantId");
CREATE INDEX "property_services_tenantId_propertyId_idx" ON "property_services"("tenantId", "propertyId");
CREATE INDEX "property_services_serviceTypeId_idx" ON "property_services"("serviceTypeId");

CREATE INDEX "properties_propertyTypeId_idx" ON "properties"("propertyTypeId");

ALTER TABLE "properties"
  ADD CONSTRAINT "properties_propertyTypeId_fkey"
  FOREIGN KEY ("propertyTypeId") REFERENCES "property_type_catalogs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "property_owners"
  ADD CONSTRAINT "property_owners_propertyId_tenantId_fkey"
  FOREIGN KEY ("propertyId", "tenantId") REFERENCES "properties"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "property_owners"
  ADD CONSTRAINT "property_owners_personaId_tenantId_fkey"
  FOREIGN KEY ("personaId", "tenantId") REFERENCES "personas"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "property_services"
  ADD CONSTRAINT "property_services_propertyId_tenantId_fkey"
  FOREIGN KEY ("propertyId", "tenantId") REFERENCES "properties"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "property_services"
  ADD CONSTRAINT "property_services_serviceTypeId_fkey"
  FOREIGN KEY ("serviceTypeId") REFERENCES "service_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
