export interface MenuCategoryDef {
  name: string;
  slug: string;
  sort_order: number;
}

export const FIXED_MENU_CATEGORIES: readonly MenuCategoryDef[] = [
  { name: 'Loaded Fries & Shakers', slug: 'loaded-fries-shakers', sort_order: 1 },
  { name: 'Burgers', slug: 'burgers', sort_order: 2 },
  { name: 'Rolls', slug: 'rolls', sort_order: 3 },
  { name: 'Starters', slug: 'starters', sort_order: 4 },
  { name: 'Hot Beverages', slug: 'hot-beverages', sort_order: 5 },
  { name: 'Cold Coffee', slug: 'cold-coffee', sort_order: 6 },
  { name: 'Shakes', slug: 'shakes', sort_order: 7 },
  { name: 'Boba', slug: 'boba', sort_order: 8 },
  { name: 'Sparkling Boba', slug: 'sparkling-boba', sort_order: 9 },
  { name: 'Special Drinks', slug: 'special-drinks', sort_order: 10 },
  { name: 'Fresh Juice', slug: 'fresh-juice', sort_order: 11 },
  { name: 'Mojitos', slug: 'mojitos', sort_order: 12 },
] as const;

export const FIXED_CATEGORY_NAMES: readonly string[] = FIXED_MENU_CATEGORIES.map((c) => c.name);

export const MAX_BESTSELLERS = 8;

const CATEGORY_ORDER_MAP = new Map<string, number>(
  FIXED_MENU_CATEGORIES.map((c) => [c.name, c.sort_order])
);

export function isValidMenuCategory(category?: string | null): category is string {
  if (!category || typeof category !== 'string') return false;
  return CATEGORY_ORDER_MAP.has(category);
}

export function getCategorySortOrder(category?: string | null): number {
  if (!category) return 999;
  return CATEGORY_ORDER_MAP.get(category) ?? 999;
}
