export interface PriceableLineItem {
  price?: number | string;
  unitPrice?: number | string;
  quantity?: number | string;
  qty?: number | string;
}

export interface OrderPricingSummary {
  count: number;
  total: number;
  tax: number;
  toPay: number;
}

/**
 * Single source of truth for Zécha! order pricing (client cart + server order creation).
 * No GST or extra taxes are added; customer pays the exact sum of menu item prices in whole rupees.
 */
export function computeOrderTotal(items: PriceableLineItem[]): OrderPricingSummary {
  let count = 0;
  let total = 0;

  for (const item of items) {
    const qty = Math.max(0, Math.round(Number(item.quantity ?? item.qty ?? 0)));
    const unitPrice = Number(item.unitPrice ?? item.price ?? 0);
    if (!Number.isFinite(qty) || !Number.isFinite(unitPrice) || qty <= 0) {
      continue;
    }
    count += qty;
    total += Math.round(unitPrice * qty);
  }

  total = Math.round(total);

  return {
    count,
    total,
    tax: 0,
    toPay: total,
  };
}

/**
 * Derives any historical tax amount on old orders where stored total exceeds sum of item prices.
 * Returns 0 for new (tax-free) orders.
 */
export function computeHistoricalOrderTax(
  storedTotal: number | string | null | undefined,
  items: PriceableLineItem[]
): number {
  const { total: itemsSum } = computeOrderTotal(items);
  const numericTotal = Math.round(Number(storedTotal || 0));
  if (itemsSum <= 0 || !Number.isFinite(numericTotal)) return 0;
  const diff = numericTotal - itemsSum;
  return diff > 0 ? diff : 0;
}
