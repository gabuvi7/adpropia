export type PropertyTypeCode = "APARTMENT" | "HOUSE" | "COMMERCIAL" | "LAND" | "OTHER";

const PROPERTY_TYPE_CODES = new Set<PropertyTypeCode>(["APARTMENT", "HOUSE", "COMMERCIAL", "LAND", "OTHER"]);

export function isPropertyTypeCode(code: string): code is PropertyTypeCode {
  return PROPERTY_TYPE_CODES.has(code as PropertyTypeCode);
}
