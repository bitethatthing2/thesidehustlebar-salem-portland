'use client';

import { AuthProvider } from '@/contexts/AuthContext';
import { LocationProvider } from '@/lib/hooks/useLocationState';
import { AuthErrorBoundary } from '@/components/auth/AuthErrorBoundary';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthErrorBoundary>
      <AuthProvider>
        <LocationProvider>
          {children}
        </LocationProvider>
      </AuthProvider>
    </AuthErrorBoundary>
  );
}

// Keep the original QueryStateProvider for backward compatibility
export function QueryStateProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
