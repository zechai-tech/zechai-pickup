import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { CartItem, CustomerDetails, Order, OrderStatus, Outlet } from '@/types';
import { resolveImageUrl, DEFAULT_MENU_IMAGE } from '@/lib/images';
import { computeOrderTotal } from '@/lib/pricing';
import { buildComboLineId } from '@/lib/combos';

interface ZechaState {
  // Outlet
  outlet: Outlet | null;

  // Order Type
  orderType: 'pickup' | 'dine_in';

  // Cart
  cart: CartItem[];

  // Customer
  customer: CustomerDetails;

  // Active Order
  activeOrder: Order | null;

  // Demo speed multiplier (1x normal, 4x fast)
  demoSpeed: 1 | 4;

  // Actions
  setOutlet: (outlet: Outlet | null) => void;
  setOrderType: (type: 'pickup' | 'dine_in') => void;
  addToCart: (item: CartItem) => void;
  addItem: (item: { id: string; name: string; price: number; image?: string; isVeg?: boolean }) => void;
  addCombo: (combo: {
    id: string;
    outlet_id?: string;
    name: string;
    price: number;
    image?: string;
    isVeg?: boolean;
    items_total?: number;
    savings?: number;
    items: Array<{
      menu_item_id?: string;
      name: string;
      quantity: number;
      price?: number;
      category?: string | null;
      is_veg?: boolean;
      outlet_id?: string;
    }>;
  }) => void;
  updateComboItemSwap: (
    lineId: string,
    itemIndex: number,
    newMenuItem: {
      id: string;
      name: string;
      price: number;
      category?: string | null;
      is_veg?: boolean;
      outlet_id?: string;
    }
  ) => void;
  updateCartQty: (lineId: string, delta: number) => void;
  removeFromCart: (lineId: string) => void;
  clearCart: () => void;
  setCustomer: (details: Partial<CustomerDetails>) => void;
  setActiveOrder: (order: Order | null) => void;
  updateOrderStatus: (status: OrderStatus) => void;
  setDemoSpeed: (speed: 1 | 4) => void;
  clearOrder: () => void;
  resetAll: () => void;
}

export const useZechaStore = create<ZechaState>()(
  persist(
    (set, get) => ({
      outlet: null,
      orderType: 'pickup',
      cart: [],
      customer: {
        name: '',
        phone: '',
        note: '',
      },
      activeOrder: null,
      demoSpeed: 1,

      setOutlet: (outlet: Outlet | null) => set({ outlet }),
      setOrderType: (type: 'pickup' | 'dine_in') => set({ orderType: type }),

      addItem: (item) => {
        const { cart } = get();
        const existing = cart.find((i) => i.itemId === item.id || i.lineId === item.id);
        if (existing) {
          const updated = cart.map((i) =>
            i.lineId === existing.lineId ? { ...i, qty: i.qty + 1 } : i
          );
          set({ cart: updated });
        } else {
          set({
            cart: [
              ...cart,
              {
                lineId: item.id,
                itemId: item.id,
                name: item.name,
                image: resolveImageUrl(item.image, 'thumb') || DEFAULT_MENU_IMAGE,
                isVeg: item.isVeg ?? true,
                unitPrice: item.price,
                qty: 1,
              },
            ],
          });
        }
      },

      addCombo: (combo) => {
        const { cart } = get();
        const comboItems = combo.items.map((it: any) => ({
          menu_item_id: it.menu_item_id || it.id || '',
          name: it.name,
          quantity: it.quantity || 1,
          unit_price: it.price,
          category: it.category,
          is_veg: it.is_veg,
          outlet_id: it.outlet_id || combo.outlet_id,
          default_item_id: it.menu_item_id || it.id || '',
          default_name: it.name,
          is_changed: false,
        }));
        const lineId = buildComboLineId(combo.id, comboItems);
        const existing = cart.find((i) => i.lineId === lineId);
        const itemsTotal = Number(combo.items_total) ||
          (combo.items ? combo.items.reduce((s: number, it: any) => s + (Number(it.price) || 0) * (Number(it.quantity) || 1), 0) : 0);
        const originalPrice = itemsTotal > combo.price ? itemsTotal : combo.price;
        const savings = Math.max(0, originalPrice - combo.price);

        if (existing) {
          const updated = cart.map((i) =>
            i.lineId === existing.lineId ? { ...i, qty: i.qty + 1 } : i
          );
          set({ cart: updated });
        } else {
          set({
            cart: [
              ...cart,
              {
                lineId,
                itemId: combo.id,
                name: combo.name,
                image: resolveImageUrl(combo.image, 'thumb') || DEFAULT_MENU_IMAGE,
                isVeg: combo.isVeg ?? true,
                unitPrice: combo.price,
                originalPrice,
                savings,
                qty: 1,
                isCombo: true,
                comboItems,
              },
            ],
          });
        }
      },

      updateComboItemSwap: (lineId, itemIndex, newMenuItem) => {
        const { cart } = get();
        const target = cart.find((i) => i.lineId === lineId);
        if (!target || !target.comboItems || !target.comboItems[itemIndex]) return;

        const currentCi = target.comboItems[itemIndex];
        const defaultId = currentCi.default_item_id || currentCi.menu_item_id;
        const defaultName = currentCi.default_name || currentCi.name;
        const isChanged = newMenuItem.id !== defaultId;

        const updatedComboItems = target.comboItems.map((ci, idx) => {
          if (idx !== itemIndex) return ci;
          return {
            ...ci,
            menu_item_id: newMenuItem.id,
            name: newMenuItem.name,
            category: newMenuItem.category ?? ci.category,
            unit_price: newMenuItem.price,
            is_veg: newMenuItem.is_veg ?? ci.is_veg,
            default_item_id: defaultId,
            default_name: defaultName,
            is_changed: isChanged,
          };
        });

        const newLineId = buildComboLineId(target.itemId, updatedComboItems);

        // Check if another line with newLineId already exists (merge if so)
        const existingOther = cart.find((i) => i.lineId === newLineId && i.lineId !== lineId);
        if (existingOther) {
          const updated = cart
            .filter((i) => i.lineId !== lineId)
            .map((i) => (i.lineId === newLineId ? { ...i, qty: i.qty + target.qty } : i));
          set({ cart: updated });
        } else {
          const updated = cart.map((i) =>
            i.lineId === lineId
              ? {
                  ...i,
                  lineId: newLineId,
                  comboItems: updatedComboItems,
                }
              : i
          );
          set({ cart: updated });
        }
      },

      addToCart: (newItem: CartItem) => {
        const { cart } = get();
        // Check if exact same lineId already exists
        const existingIndex = cart.findIndex((i) => i.lineId === newItem.lineId || i.itemId === newItem.itemId);
        if (existingIndex > -1) {
          const updated = [...cart];
          updated[existingIndex].qty += newItem.qty;
          set({ cart: updated });
        } else {
          set({ cart: [...cart, newItem] });
        }
      },

      updateCartQty: (lineId: string, delta: number) => {
        const { cart } = get();
        const updated = cart
          .map((item) => {
            if (item.lineId === lineId) {
              const newQty = item.qty + delta;
              return newQty > 0 ? { ...item, qty: newQty } : null;
            }
            return item;
          })
          .filter((item): item is CartItem => item !== null);
        set({ cart: updated });
      },

      removeFromCart: (lineId: string) => {
        const { cart } = get();
        set({ cart: cart.filter((i) => i.lineId !== lineId) });
      },

      clearCart: () => set({ cart: [], orderType: 'pickup' }),

      setCustomer: (details: Partial<CustomerDetails>) => {
        set((state) => ({
          customer: {
            ...state.customer,
            ...details,
          },
        }));
      },

      setActiveOrder: (order: Order | null) => set({ activeOrder: order }),

      updateOrderStatus: (status: OrderStatus) => {
        set((state) => {
          if (!state.activeOrder) return state;
          const now = Date.now();
          const history = { ...state.activeOrder.statusHistory };
          if (status === 'accepted') history.acceptedAt = now;
          if (status === 'preparing') history.preparingAt = now;
          if (status === 'ready') history.readyAt = now;
          if (status === 'picked_up') history.pickedUpAt = now;

          return {
            activeOrder: {
              ...state.activeOrder,
              status,
              statusHistory: history,
            },
          };
        });
      },

      setDemoSpeed: (speed: 1 | 4) => set({ demoSpeed: speed }),

      clearOrder: () => set({ activeOrder: null, cart: [], orderType: 'pickup' }),

      resetAll: () =>
        set({
          outlet: null,
          cart: [],
          activeOrder: null,
          orderType: 'pickup',
        }),
    }),
    {
      name: 'zecha_store_session',
      storage: createJSONStorage(() => {
        if (typeof window !== 'undefined') {
          try {
            window.localStorage.removeItem('zecha_store_storage');
            window.localStorage.removeItem('activeOrderId');
            window.localStorage.removeItem('activeOrderCode');
            window.localStorage.removeItem('activeOrderTime');
          } catch {
            // ignore storage errors
          }
          return window.sessionStorage;
        }
        return {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        } as unknown as Storage;
      }),
      partialize: (state) => ({
        cart: state.cart,
      }),
    }
  )
);

// Derived helper functions — delegates directly to single shared pricing source of truth
export function getCartSummary(cart: CartItem[], packagingFeeEnabled = true) {
  const summary = computeOrderTotal(cart, { packagingFeeEnabled });
  return {
    count: summary.count,
    physicalItemCount: summary.physicalItemCount,
    originalItemTotal: summary.originalItemTotal,
    itemsTotal: summary.itemsTotal,
    comboSavings: summary.comboSavings,
    packagingFee: summary.packagingFee,
    toPay: summary.toPay,
    total: summary.total,
    tax: summary.tax,
    itemTotal: summary.itemsTotal,
    gst: summary.tax,
    grandTotal: summary.toPay,
  };
}
