import type { Prisma, Property, PropertyStatus } from "@adpropia/database";

export type PropertyWithActiveContracts = Property & {
  contracts?: { id: string }[];
  contractProperties?: { id: string }[];
};

export const activeContractStatusInclude = {
  contracts: { where: { status: "ACTIVE" }, select: { id: true }, take: 1 },
  contractProperties: { where: { contract: { status: "ACTIVE" } }, select: { id: true }, take: 1 }
} satisfies Prisma.PropertyInclude;

export function toOperationalPropertyStatus(property: PropertyWithActiveContracts): Property {
  const { contracts = [], contractProperties = [], ...record } = property;
  return {
    ...record,
    status: deriveOperationalPropertyStatus(record.status, contracts, contractProperties)
  };
}

export function getOperationalPropertyStatus(property: PropertyWithActiveContracts): PropertyStatus {
  return deriveOperationalPropertyStatus(property.status, property.contracts ?? [], property.contractProperties ?? []);
}

export function withActiveContractsFromPersistedProperty(
  updatedPersistedProperty: Property,
  persistedProperty: PropertyWithActiveContracts
): PropertyWithActiveContracts {
  return {
    ...updatedPersistedProperty,
    contracts: persistedProperty.contracts ?? [],
    contractProperties: persistedProperty.contractProperties ?? []
  };
}

export function isOperationalStatusChange(previousOperationalStatus: PropertyStatus, nextOperationalStatus: PropertyStatus): boolean {
  return nextOperationalStatus !== previousOperationalStatus;
}

function deriveOperationalPropertyStatus(
  persistedStatus: PropertyStatus,
  activeContracts: { id: string }[],
  activeContractProperties: { id: string }[]
): PropertyStatus {
  return hasActiveContract(activeContracts, activeContractProperties) ? "RENTED" : persistedStatus;
}

function hasActiveContract(contracts: { id: string }[], contractProperties: { id: string }[]): boolean {
  return contracts.length > 0 || contractProperties.length > 0;
}
