export const PACKAGING_FEE_PER_ITEM = 10;

export interface PriceableLineItem {
  price?: number | string;
  unitPrice?: number | string;
  quantity?: number | string;
  qty?: number | string;
  isCombo?: boolean;
  is_combo?: boolean;
  comboItems?: Array<{ name: string; quantity: number; unit_price?: number }>;
  combo_items?: Array<{ name: string; quantity: number; unit_price?: number }>;
  originalPrice?: number;
  original_price?: number;
  savings?: number;
}

export interface OrderPricingSummary {
  count: number;              // total line items quantity
  physicalItemCount: number;  // total physical items (combos count included items * qty)
  originalItemTotal: number;  // items sum at original full prices
  itemsTotal: number;         // items sum at combo/actual prices
  comboSavings: number;       // total combo savings (originalItemTotal - itemsTotal)
  packagingFee: number;       // physicalItemCount * PACKAGING_FEE_PER_ITEM
  toPay: number;              // itemsTotal + packagingFee
  total: number;              // same as toPay
  tax: number;                // 0 (no extra tax)
}

/**
 * Counts total physical items in an order.
 * Normal items count as 1 item per quantity.
 * Combos count as the number of items inside it, multiplied by combo quantity.
 */
export function countPhysicalItems(items: PriceableLineItem[]): number {
  let physicalCount = 0;

  for (const item of items) {
    const qty = Math.max(0, Math.round(Number(item.quantity ?? item.qty ?? 0)));
    if (!Number.isFinite(qty) || qty <= 0) continue;

    const isCombo = Boolean(item.isCombo || item.is_combo);
    if (isCombo) {
      const comboItems = item.comboItems || item.combo_items || [];
      const itemsInside =
        comboItems.length > 0
          ? comboItems.reduce((acc, ci: any) => acc + (Number(ci.quantity ?? ci.qty ?? 1) || 1), 0)
          : 2; // default fallback minimum 2 items
      physicalCount += itemsInside * qty;
    } else {
      physicalCount += qty;
    }
  }

  return physicalCount;
}

/**
 * Single source of truth for Zécha! order pricing (client cart + server order creation).
 * Recalculates:
 * 1. originalItemTotal (items at original full prices)
 * 2. itemsTotal (items at actual / combo price)
 * 3. comboSavings (originalItemTotal - itemsTotal)
 * 4. packagingFee (physical items * ₹10)
 * 5. toPay (itemsTotal + packagingFee)
 */
export function computeOrderTotal(items: PriceableLineItem[]): OrderPricingSummary {
  let count = 0;
  let itemsTotal = 0;
  let originalItemTotal = 0;

  for (const item of items) {
    const qty = Math.max(0, Math.round(Number(item.quantity ?? item.qty ?? 0)));
    const unitPrice = Number(item.unitPrice ?? item.price ?? 0);
    if (!Number.isFinite(qty) || !Number.isFinite(unitPrice) || qty <= 0) {
      continue;
    }

    count += qty;
    const lineTotal = Math.round(unitPrice * qty);
    itemsTotal += lineTotal;

    const isCombo = Boolean(item.isCombo || item.is_combo);
    const origUnitPrice = Number(item.originalPrice ?? item.original_price ?? 0);
    if (isCombo && origUnitPrice > unitPrice) {
      originalItemTotal += Math.round(origUnitPrice * qty);
    } else {
      originalItemTotal += lineTotal;
    }
  }

  itemsTotal = Math.round(itemsTotal);
  originalItemTotal = Math.round(originalItemTotal);
  const comboSavings = Math.max(0, originalItemTotal - itemsTotal);
  const physicalItemCount = countPhysicalItems(items);
  const packagingFee = items.length > 0 ? physicalItemCount * PACKAGING_FEE_PER_ITEM : 0;
  const toPay = itemsTotal + packagingFee;

  return {
    count,
    physicalItemCount,
    originalItemTotal,
    itemsTotal,
    comboSavings,
    packagingFee,
    toPay,
    total: toPay,
    tax: 0,
  };
}

/**
 * Derives any historical tax amount on old orders where stored total exceeds sum of item prices.
 * Returns 0 for new orders.
 */
export function computeHistoricalOrderTax(
  storedTotal: number | string | null | undefined,
  items: PriceableLineItem[]
): number {
  const numericTotal = Math.round(Number(storedTotal || 0));
  if (!Number.isFinite(numericTotal) || numericTotal <= 0) return 0;

  const itemsSum = items.reduce((sum, item) => {
    const qty = Math.max(0, Math.round(Number(item.quantity ?? item.qty ?? 0)));
    const unitPrice = Number(item.unitPrice ?? item.price ?? 0);
    return sum + (Number.isFinite(qty) && Number.isFinite(unitPrice) ? Math.round(unitPrice * qty) : 0);
  }, 0);

  if (itemsSum <= 0) return 0;
  const diff = numericTotal - itemsSum;
  return diff > 0 ? diff : 0;
}
