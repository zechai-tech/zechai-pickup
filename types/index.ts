export type OutletStatus = 'open' | 'closed';

export type MenuTheme = 'classic' | 'grid';

export interface Outlet {
  id: string;
  name: string;
  statusText?: string;
  isOpen: boolean;
  is_active?: boolean;
  closingTime?: string;
  openingTime?: string;
  address?: string;
  phone?: string | null;
  menu_theme?: MenuTheme;
}

export interface MenuItemOption {
  id: string;
  name: string;
  priceDelta: number;
}

export interface MenuItemSize {
  id: string;
  name: string;
  volume: string;
  price: number;
}

export interface MenuItem {
  id: string;
  name: string;
  category: string | null;
  category_slug?: string | null;
  category_sort_order?: number;
  price: number;
  description: string;
  image: string;
  image_url?: string;
  isVeg: boolean;
  is_veg?: boolean;
  isBestseller?: boolean;
  is_bestseller?: boolean;
  hasCustomization?: boolean;
  sizes?: MenuItemSize[];
  sugarLevels?: ('No sugar' | 'Less' | 'Regular')[];
  addons?: MenuItemOption[];
  is_available?: boolean;
  outlet_id?: string;
  sort_order?: number;
}

export interface CartItemAddon {
  id: string;
  name: string;
  priceDelta: number;
}

export interface CartItem {
  lineId: string;
  itemId: string;
  name: string;
  image: string;
  isVeg: boolean;
  size?: string;
  sugar?: 'No sugar' | 'Less' | 'Regular';
  selectedSize?: string;
  selectedSugar?: string;
  addons?: CartItemAddon[];
  unitPrice: number;
  qty: number;
}

export interface CustomerDetails {
  name: string;
  phone: string;
  note?: string;
}

export type PaymentMethod = 'gpay' | 'phonepe' | 'paytm' | 'bhim' | 'upi_id' | 'card' | 'netbanking' | 'wallet';

export type OrderStatus = 'placed' | 'accepted' | 'preparing' | 'ready' | 'picked_up';

export interface OrderTimelineStep {
  status: OrderStatus;
  label: string;
  timestamp: string; // e.g. "6:42 PM"
  isCompleted: boolean;
  isCurrent: boolean;
}

export interface Order {
  id: string; // e.g. "ZC-2481"
  code: string; // 4-digit e.g. "7309"
  placedAt: number; // unix ms timestamp
  estimatedReadyTime: string; // e.g. "~6:54 PM"
  paidAmount: number;
  paymentMethod: string;
  status: OrderStatus;
  outlet: Outlet;
  items: CartItem[];
  itemTotal: number;
  gst: number;
  grandTotal: number;
  customer: CustomerDetails;
  statusHistory: {
    placedAt: number;
    acceptedAt?: number;
    preparingAt?: number;
    readyAt?: number;
    pickedUpAt?: number;
  };
}
