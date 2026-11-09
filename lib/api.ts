import { CartItem, CustomerDetails, MenuItem, Order, OrderStatus, Outlet } from '@/types';
import { MOCK_MENU, MOCK_OUTLETS } from './mock-data';
import { generateOrderId, generatePickupCode, getEstimatedReadyTime } from './utils';

// Artificial delay helper to simulate network latency
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function getOutlets(): Promise<Outlet[]> {
  await delay(180);
  return [...MOCK_OUTLETS];
}

export async function getOutletById(id: string): Promise<Outlet | null> {
  await delay(120);
  const found = MOCK_OUTLETS.find((o) => o.id === id);
  return found ? { ...found } : null;
}

export async function getMenu(outletId?: string): Promise<MenuItem[]> {
  await delay(220);
  return [...MOCK_MENU];
}

export async function getMenuItemById(id: string): Promise<MenuItem | null> {
  await delay(150);
  const found = MOCK_MENU.find((item) => item.id === id);
  return found ? { ...found } : null;
}

export interface CreateOrderPayload {
  outlet: Outlet;
  items: CartItem[];
  customer: CustomerDetails;
  paymentMethod: string;
  itemTotal: number;
  gst: number;
  grandTotal: number;
}

export async function createOrder(payload: CreateOrderPayload): Promise<Order> {
  await delay(300);
  const now = Date.now();
  const orderId = generateOrderId();
  const code = generatePickupCode();

  const newOrder: Order = {
    id: orderId,
    code,
    placedAt: now,
    estimatedReadyTime: getEstimatedReadyTime(new Date(now), 12),
    paidAmount: payload.grandTotal,
    paymentMethod: payload.paymentMethod,
    status: 'placed',
    outlet: payload.outlet,
    items: payload.items,
    itemTotal: payload.itemTotal,
    gst: payload.gst,
    grandTotal: payload.grandTotal,
    customer: payload.customer,
    statusHistory: {
      placedAt: now,
    },
  };

  return newOrder;
}

export interface ProcessPaymentPayload {
  orderId: string;
  amount: number;
  method: string;
  details?: Record<string, string>;
  shouldFail?: boolean;
}

export interface PaymentResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

export async function createPayment(payload: ProcessPaymentPayload): Promise<PaymentResult> {
  await delay(1800); // 1.8 - 2.0s realistic mock gateway processing
  if (payload.shouldFail) {
    return {
      success: false,
      error: 'Payment declined by issuing bank or UPI provider. Please try again.',
    };
  }
  return {
    success: true,
    transactionId: `pay_mock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
  };
}

export async function getOrderStatus(orderId: string): Promise<{ orderId: string; status: OrderStatus } | null> {
  await delay(150);
  return { orderId, status: 'placed' };
}
