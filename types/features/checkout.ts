// Import types from unified system
import type { CartItem } from './order'; // Basic cart item type
import type { BartenderOrder } from './order';

// SIMPLIFIED CHECKOUT - Wolf Pack Orders: Pay at Bar Only
// No online payment processing - orders are placed and paid at the bar

// Simplified Order Request for Wolf Pack Members
export interface WolfPackOrderRequest {
  // Cart Items (from current cart state)
  items: CartItem[];
  
  // Order Details
  orderDetails: {
    location: 'salem' | 'portland';
    customerNotes?: string;
  };
  
  // Simple totals (calculated client-side for display only)
  totals: {
    subtotal: number;
    total: number;
    itemCount: number;
  };
}

// Legacy interfaces kept for compatibility during migration
export interface CheckoutFormData extends WolfPackOrderRequest {
  customer: CustomerInfo;
  payment: PaymentInfo;
}

export interface CustomerInfo {
  id?: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  isGuest: boolean;
  preferredLocationId?: string;
  notificationPreferences?: OrderNotificationPreferences;
}

export interface OrderNotificationPreferences {
  orderUpdates: boolean;
  orderReady: boolean;
  smsNotifications: boolean;
  emailNotifications: boolean;
}

export interface OrderDetails {
  orderType: 'pickup' | 'table_delivery';
  location: LocationInfo;
  tableLocation?: string;
  pickupTime?: string;
  isScheduled?: boolean;
  customerNotes?: string;
}

export interface LocationInfo {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
}

// SIMPLIFIED: Wolf Pack Payment - Pay at Bar Only
export interface PaymentInfo {
  method: 'pay_at_bar'; // Only payment method supported
}

export type PaymentMethod = 'pay_at_bar'; // Simplified to bar payment only

// SIMPLIFIED: Wolf Pack Order Totals (Display Only - Pay at Bar)
export interface OrderTotals {
  subtotal: number;
  total: number; // Same as subtotal - no tax/tip processing
  itemCount: number;
}

// API Request/Response Types for Wolf Pack Orders
export interface CreateOrderRequest {
  customer_id?: string;
  location_id: string;
  status: 'pending';
  items: CartItem[];
  total_amount: number;
  customer_notes?: string;
  payment_status: 'pending'; // Always pending - pay at bar
}

export interface CreateOrderResponse {
  order: BartenderOrder | null;
  success: boolean;
  message?: string;
}

// SIMPLIFIED: Wolf Pack Order Helper Functions
export const calculateOrderTotals = (items: CartItem[]): OrderTotals => {
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const itemCount = items.reduce((count, item) => count + item.quantity, 0);

  return {
    subtotal,
    total: subtotal, // No tax/tip - pay at bar
    itemCount
  };
};

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
  return emailRegex.test(email);
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
};

export const formatOrderNumber = (orderNumber: number): string => {
  return `#${orderNumber.toString().padStart(4, '0')}`;
};

// SIMPLIFIED: Wolf Pack Initial State
export const initialCheckoutState: CheckoutFormData = {
  customer: {
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    isGuest: true,
    notificationPreferences: {
      orderUpdates: true,
      orderReady: true,
      smsNotifications: false,
      emailNotifications: true
    }
  },
  orderDetails: {
    location: 'salem',
    customerNotes: ''
  },
  items: [],
  payment: {
    method: 'pay_at_bar'
  },
  totals: {
    subtotal: 0,
    total: 0,
    itemCount: 0
  }
};

// Type Guards
export const isValidPaymentMethod = (method: string): method is PaymentMethod => {
  return method === 'pay_at_bar';
};

// Order Status Tracking
export interface OrderStatusUpdate {
  orderId: string;
  status: BartenderOrder['status'];
  timestamp: string;
  message?: string;
}

export const ORDER_STATUS_MESSAGES: Record<NonNullable<BartenderOrder['status']>, string> = {
  pending: 'Your order has been received',
  accepted: 'Your order has been accepted by the bartender',
  preparing: 'Your order is being prepared',
  ready: 'Your order is ready!',
  delivered: 'Your order has been delivered',
  completed: 'Order completed - thank you!',
  cancelled: 'Your order has been cancelled'
};

// WOLF PACK ERROR MESSAGES - Simplified
export const CHECKOUT_ERROR_MESSAGES = {
  general: {
    cartEmpty: 'Your cart is empty',
    wolfpackRequired: 'You must join the Wolf Pack to place orders',
    locationRequired: 'You must be at the bar location to place orders',
    serverError: 'An error occurred. Please try again.'
  }
};
