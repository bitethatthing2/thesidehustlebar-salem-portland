'use client';

import { AuthProvider } from '@/contexts/AuthContext';
import { NotificationProvider } from '@/lib/contexts/unified-notification-context';
import { UserProvider } from '@/contexts/UserContext';
import { LocationProvider } from '@/lib/hooks/useLocationState';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import { AuthErrorBoundary } from '@/components/auth/AuthErrorBoundary';
import { CartProvider } from '@/components/cart/CartContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthErrorBoundary>
      <AuthProvider>
        <UserProvider>
          <LocationProvider>
            <NotificationProvider>
              <CartProvider>
                <NuqsAdapter>
                  {children}
                </NuqsAdapter>
              </CartProvider>
            </NotificationProvider>
          </LocationProvider>
        </UserProvider>
      </AuthProvider>
    </AuthErrorBoundary>
  );
}

// Keep the original QueryStateProvider for backward compatibility
export function QueryStateProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
