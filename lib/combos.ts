export interface SwappableMenuItem {
  id: string;
  name: string;
  category: string | null;
  price: number;
  is_veg: boolean;
  is_available: boolean;
  outlet_id?: string;
  image_url?: string | null;
}

export interface CartComboItem {
  menu_item_id: string;
  name: string;
  quantity: number;
  unit_price?: number;
  category?: string | null;
  is_veg?: boolean;
  outlet_id?: string;
  default_item_id?: string;
  default_name?: string;
  is_changed?: boolean;
}

/**
 * An included item X can be swapped for item Y only if ALL are true:
 * 1. Y is in the same outlet as X (if outlet_id present)
 * 2. Y is in the same category as X
 * 3. Y has exactly the same price as X
 * 4. Y has the same veg / non-veg type as X
 * 5. Y is available (not sold out)
 * 6. Y is not the same as X (id !== currentItem.id)
 */
export function getAllowedSwaps(
  currentItem: {
    menu_item_id?: string;
    id?: string;
    category?: string | null;
    price?: number;
    unit_price?: number;
    is_veg?: boolean;
    outlet_id?: string;
  },
  allOutletItems: SwappableMenuItem[]
): SwappableMenuItem[] {
  const currentId = currentItem.menu_item_id || currentItem.id;
  if (!currentId || !currentItem.category) return [];

  const currentPrice = Math.round(Number(currentItem.price ?? currentItem.unit_price) || 0);
  const currentCategory = currentItem.category.trim().toLowerCase();
  const currentVeg = Boolean(currentItem.is_veg);

  return allOutletItems.filter((candidate) => {
    // 1. Not the same item
    if (candidate.id === currentId) return false;
    // 2. Must be available
    if (!candidate.is_available) return false;
    // 3. Same category
    if (!candidate.category || candidate.category.trim().toLowerCase() !== currentCategory) return false;
    // 4. Exactly same price
    if (Math.round(Number(candidate.price) || 0) !== currentPrice) return false;
    // 5. Same veg / non-veg type
    if (Boolean(candidate.is_veg) !== currentVeg) return false;
    // 6. Same outlet (if both specified)
    if (currentItem.outlet_id && candidate.outlet_id && currentItem.outlet_id !== candidate.outlet_id) return false;

    return true;
  });
}

/**
 * Builds a deterministic cart lineId for a combo based on its selected item IDs.
 * Combos with different flavours will produce different line IDs and stay separate lines.
 */
export function buildComboLineId(comboId: string, comboItems: Array<{ menu_item_id: string }>): string {
  if (!comboItems || comboItems.length === 0) {
    return `combo-${comboId}`;
  }
  const itemsKey = comboItems
    .map((it) => it.menu_item_id)
    .sort()
    .join('-');
  return `combo-${comboId}-${itemsKey}`;
}
