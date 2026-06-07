import { PrismaClient } from "@prisma/client";

export { PrismaClient };
export type {
  CashMovement,
  CashMovementType,
  Currency,
  Document,
  DocumentType,
  EconomicIndexType,
  Liquidation,
  LiquidationAdjustmentSign,
  LiquidationLineItem,
  LiquidationManualAdjustment,
  LiquidationStatus,
  Owner,
  Persona,
  PersonaFisica,
  PersonaJuridica,
  PersonaKind,
  Payment,
  PaymentStatus,
  Prisma,
  Property,
  PropertyStatus,
  PropertyType,
  RentalContract,
  RentalContractStatus,
  Renter,
  Tenant,
  TenantSettings,
  TenantStatus,
  TenantUser,
  User
} from "@prisma/client";

export type PrismaCompatibleClient = PrismaClient;
