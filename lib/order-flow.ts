import { OrderStatus } from '@/types/supabase';

export type CanonicalStatus =
  | 'pending_payment'
  | 'pending'
  | 'preparing'
  | 'packaging'
  | 'ready'
  | 'received'
  | 'cancelled'
  | 'payment_cancelled';

/**
 * Normalizes any legacy or external status to our canonical lifecycle statuses.
 * Legacy mappings:
 * - confirmed -> preparing
 * - completed -> received
 * - payment_failed -> payment_cancelled
 * - accepted -> preparing
 * - picked_up -> received
 */
export function normalizeOrderStatus(status: string | null | undefined): CanonicalStatus {
  if (!status) return 'pending_payment';
  const s = status.trim().toLowerCase();

  switch (s) {
    case 'pending_payment':
      return 'pending_payment';
    case 'pending':
      return 'pending';
    case 'confirmed':
    case 'accepted':
    case 'preparing':
      return 'preparing';
    case 'packaging':
      return 'packaging';
    case 'ready':
      return 'ready';
    case 'completed':
    case 'picked_up':
    case 'received':
      return 'received';
    case 'cancelled':
      return 'cancelled';
    case 'payment_failed':
    case 'payment_cancelled':
      return 'payment_cancelled';
    default:
      return 'pending_payment';
  }
}

export interface StatusMeta {
  status: CanonicalStatus;
  label: string;
  customerHeadline: string;
  customerDescription: string;
  adminActionLabel?: string;
  nextStatus?: CanonicalStatus;
}

export const ORDER_FLOW_CONFIG: Record<CanonicalStatus, StatusMeta> = {
  pending_payment: {
    status: 'pending_payment',
    label: 'Awaiting Payment',
    customerHeadline: 'Awaiting Payment',
    customerDescription: 'Complete your payment to send this order to the kitchen.',
  },
  pending: {
    status: 'pending',
    label: 'Payment Successful',
    customerHeadline: 'Payment Received',
    customerDescription: 'Payment received. Waiting for the outlet to confirm your order.',
    adminActionLabel: 'Confirm Order',
    nextStatus: 'preparing',
  },
  preparing: {
    status: 'preparing',
    label: 'Making',
    customerHeadline: 'Being Made',
    customerDescription: 'The kitchen is preparing your freshly brewed order.',
    adminActionLabel: 'Done Making',
    nextStatus: 'packaging',
  },
  packaging: {
    status: 'packaging',
    label: 'Packaging',
    customerHeadline: 'Packing',
    customerDescription: 'Your order is being neatly packed and prepared for pickup.',
    adminActionLabel: 'Done Packaging',
    nextStatus: 'ready',
  },
  ready: {
    status: 'ready',
    label: 'Completed',
    customerHeadline: 'Ready for Pickup',
    customerDescription: 'Your order is ready at the counter! Show your pickup code to collect.',
    adminActionLabel: 'Give to Customer',
    nextStatus: 'received',
  },
  received: {
    status: 'received',
    label: 'Customer Received',
    customerHeadline: 'Order Handed Over',
    customerDescription: 'Enjoy your order! Thank you for picking up with Zécha!',
  },
  cancelled: {
    status: 'cancelled',
    label: 'Order Cancelled',
    customerHeadline: 'Order Cancelled',
    customerDescription: 'Order cancelled by outlet.',
  },
  payment_cancelled: {
    status: 'payment_cancelled',
    label: 'Payment Cancelled',
    customerHeadline: 'Payment Not Completed',
    customerDescription: 'Your payment was not completed.',
  },
};

/**
 * Valid staff transitions (staff can move forward one step, or cancel from active stages).
 */
export const ALLOWED_STAFF_TRANSITIONS: Record<CanonicalStatus, CanonicalStatus[]> = {
  pending_payment: [], // System only
  pending: ['preparing', 'cancelled'],
  preparing: ['packaging', 'cancelled'],
  packaging: ['ready', 'cancelled'],
  ready: ['received', 'cancelled'],
  received: [],
  cancelled: [],
  payment_cancelled: [],
};

/**
 * System transitions (e.g. from Cashfree webhooks / payment sync)
 */
export const ALLOWED_SYSTEM_TRANSITIONS: Record<CanonicalStatus, CanonicalStatus[]> = {
  pending_payment: ['pending', 'payment_cancelled'],
  payment_cancelled: ['pending'], // Late payment success
  pending: [],
  preparing: [],
  packaging: [],
  ready: [],
  received: [],
  cancelled: [],
};

export function isValidStaffTransition(currentStatus: string, nextStatus: string): boolean {
  const current = normalizeOrderStatus(currentStatus);
  const next = normalizeOrderStatus(nextStatus);
  const allowed = ALLOWED_STAFF_TRANSITIONS[current] || [];
  return allowed.includes(next);
}

export function isValidSystemTransition(currentStatus: string, nextStatus: string): boolean {
  const current = normalizeOrderStatus(currentStatus);
  const next = normalizeOrderStatus(nextStatus);
  const allowed = ALLOWED_SYSTEM_TRANSITIONS[current] || [];
  return allowed.includes(next);
}

export type CustomerStageState = 'completed' | 'current' | 'future';

export interface CustomerStageProgress {
  canonicalStatus: CanonicalStatus;
  stageMap: Record<number, CustomerStageState>;
  getStage: (stageNum: number) => CustomerStageState;
  activeStageNum: number | null;
  isReady: boolean;
  isReceived: boolean;
  isCancelled: boolean;
  isPaymentCancelled: boolean;
  bannerStatusText: string;
}

/**
 * Single source of truth for the 6 customer tracker stages:
 * 1. Payment received
 * 2. Order confirmed
 * 3. Being made
 * 4. Packing
 * 5. Ready for pickup
 * 6. Received
 *
 * Ticked stages (green circle with check) per status:
 * - pending: stage 1 ticked. Stage 2 ACTIVE (orange pulse). Others grey.
 * - preparing: stages 1-2 ticked. Stage 3 ACTIVE.
 * - packaging: stages 1-3 ticked. Stage 4 ACTIVE.
 * - ready: stages 1-5 ALL ticked. No pulsing stage. Stage 6 grey.
 * - received: ALL 6 ticked.
 */
export function getCustomerStageState(status: string | null | undefined): CustomerStageProgress {
  const canonical = normalizeOrderStatus(status);

  const stageMap: Record<number, CustomerStageState> = {
    1: 'future',
    2: 'future',
    3: 'future',
    4: 'future',
    5: 'future',
    6: 'future',
  };

  let activeStageNum: number | null = null;

  switch (canonical) {
    case 'pending':
      stageMap[1] = 'completed';
      stageMap[2] = 'current';
      activeStageNum = 2;
      break;
    case 'preparing':
      stageMap[1] = 'completed';
      stageMap[2] = 'completed';
      stageMap[3] = 'current';
      activeStageNum = 3;
      break;
    case 'packaging':
      stageMap[1] = 'completed';
      stageMap[2] = 'completed';
      stageMap[3] = 'completed';
      stageMap[4] = 'current';
      activeStageNum = 4;
      break;
    case 'ready':
      stageMap[1] = 'completed';
      stageMap[2] = 'completed';
      stageMap[3] = 'completed';
      stageMap[4] = 'completed';
      stageMap[5] = 'completed';
      // ready is an end state waiting collection: stages 1-5 ticked, stage 6 grey, no active pulse
      activeStageNum = null;
      break;
    case 'received':
      stageMap[1] = 'completed';
      stageMap[2] = 'completed';
      stageMap[3] = 'completed';
      stageMap[4] = 'completed';
      stageMap[5] = 'completed';
      stageMap[6] = 'completed';
      // received is final state: ALL 6 ticked, no active pulse
      activeStageNum = null;
      break;
    default:
      break;
  }

  let bannerStatusText = 'is confirmed';
  if (canonical === 'ready') {
    bannerStatusText = 'is ready!';
  } else if (canonical === 'received') {
    bannerStatusText = 'is received';
  } else if (canonical === 'packaging') {
    bannerStatusText = 'is being packed';
  } else if (canonical === 'preparing') {
    bannerStatusText = 'is being prepared';
  }

  return {
    canonicalStatus: canonical,
    stageMap,
    getStage: (stageNum: number) => stageMap[stageNum] || 'future',
    activeStageNum,
    isReady: canonical === 'ready',
    isReceived: canonical === 'received',
    isCancelled: canonical === 'cancelled',
    isPaymentCancelled: canonical === 'payment_cancelled',
    bannerStatusText,
  };
}

/**
 * Determines which timestamp column should be populated for a given target status.
 */
export function getTransitionTimestampColumns(targetStatus: CanonicalStatus) {
  const now = new Date().toISOString();
  switch (targetStatus) {
    case 'preparing':
      return { confirmed_at: now, making_at: now };
    case 'packaging':
      return { packaging_at: now };
    case 'ready':
      return { ready_at: now };
    case 'received':
      return { received_at: now };
    case 'cancelled':
      return { cancelled_at: now };
    default:
      return {};
  }
}
