export type ExpenseScope = "business" | "personal" | "mixed";

const BUSINESS_CATEGORIES = new Set([
  "inventory",
  "raw_materials",
  "business_rent",
  "equipment",
  "marketing",
  "supplier_payment",
  "labor",
  "packaging",
  "business_supplies",
]);

const PERSONAL_CATEGORIES = new Set([
  "food",
  "groceries",
  "healthcare",
  "education",
  "shopping",
  "entertainment",
  "subscriptions",
]);

export function classifyScope(category: string): ExpenseScope {
  const normalized = category.trim().toLowerCase();
  if (BUSINESS_CATEGORIES.has(normalized)) return "business";
  if (PERSONAL_CATEGORIES.has(normalized)) return "personal";
  return "mixed";
}

export function resolveScope(
  category: string,
  override: string | null | undefined
): ExpenseScope {
  if (override === "business" || override === "personal") return override;
  return classifyScope(category);
}

export const BUSINESS_CATEGORIES_LIST = [
  "inventory",
  "raw_materials",
  "business_rent",
  "equipment",
  "packaging",
  "supplier_payment",
  "labor",
  "marketing",
  "business_supplies",
];
