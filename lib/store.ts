import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { CartItem, CustomerDetails, Order, OrderStatus, Outlet } from '@/types';
import { resolveImageUrl, DEFAULT_MENU_IMAGE } from '@/lib/images';
import { computeOrderTotal } from '@/lib/pricing';

interface ZechaState {
  // Outlet
  outlet: Outlet | null;

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
  addToCart: (item: CartItem) => void;
  addItem: (item: { id: string; name: string; price: number; image?: string; isVeg?: boolean }) => void;
  addCombo: (combo: {
    id: string;
    name: string;
    price: number;
    image?: string;
    isVeg?: boolean;
    items_total?: number;
    savings?: number;
    items: Array<{ name: string; quantity: number; price?: number }>;
  }) => void;
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
      cart: [],
      customer: {
        name: '',
        phone: '',
        note: '',
      },
      activeOrder: null,
      demoSpeed: 1,

      setOutlet: (outlet: Outlet | null) => set({ outlet }),

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
        const lineId = 'combo-' + combo.id;
        const existing = cart.find((i) => i.lineId === lineId || (i.isCombo && i.itemId === combo.id));
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
                comboItems: combo.items.map((it) => ({
                  name: it.name,
                  quantity: it.quantity,
                  unit_price: it.price,
                })),
              },
            ],
          });
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

      clearCart: () => set({ cart: [] }),

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

      clearOrder: () => set({ activeOrder: null, cart: [] }),

      resetAll: () =>
        set({
          outlet: null,
          cart: [],
          activeOrder: null,
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
export function getCartSummary(cart: CartItem[]) {
  const summary = computeOrderTotal(cart);
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
