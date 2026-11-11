import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { CartItem, CustomerDetails, Order, OrderStatus, Outlet } from '@/types';

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
  setOutlet: (outlet: Outlet) => void;
  addToCart: (item: CartItem) => void;
  addItem: (item: { id: string; name: string; price: number; image?: string; isVeg?: boolean }) => void;
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

      setOutlet: (outlet: Outlet) => set({ outlet }),

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
                image: item.image || '/assets/chai.jpg',
                isVeg: item.isVeg ?? true,
                unitPrice: item.price,
                qty: 1,
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
      name: 'zecha_store_storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        outlet: state.outlet,
        cart: state.cart,
        customer: state.customer,
        activeOrder: state.activeOrder,
        demoSpeed: state.demoSpeed,
      }),
    }
  )
);

// Derived helper functions
export function getCartSummary(cart: CartItem[]) {
  const count = cart.reduce((acc, item) => acc + item.qty, 0);
  const itemTotal = cart.reduce((acc, item) => acc + Number(item.unitPrice || 0) * item.qty, 0);
  const gst = Math.round(itemTotal * 0.05); // GST 5%
  const grandTotal = itemTotal + gst;
  return { count, itemTotal, gst, grandTotal };
}
