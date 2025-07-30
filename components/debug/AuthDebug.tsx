'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useConsistentAuth } from '@/lib/hooks/useConsistentAuth';

export function AuthDebug() {
  const { user: dbUser, loading } = useConsistentAuth();
  const [authUser, setAuthUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check session
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        setSession(currentSession);
        
        // Check auth user
        const { data: { user: currentUser }, error } = await supabase.auth.getUser();
        setAuthUser(currentUser);
        
        if (error) {
          setAuthError(error.message);
        } else {
          setAuthError(null);
        }
      } catch (error) {
        setAuthError(error instanceof Error ? error.message : 'Unknown error');
      }
    };

    checkAuth();
  }, []);

  if (loading) {
    return <div className="p-4 bg-gray-800 text-white">Loading auth debug...</div>;
  }

  return (
    <div className="fixed top-4 right-4 p-4 bg-gray-800 text-white text-xs max-w-md z-50 rounded">
      <h3 className="font-bold mb-2">Auth Debug</h3>
      
      <div className="mb-2">
        <strong>Database User:</strong> {dbUser ? `${dbUser.id} (${dbUser.email})` : 'None'}
      </div>
      
      <div className="mb-2">
        <strong>Auth User:</strong> {authUser ? `${authUser.id} (${authUser.email})` : 'None'}
      </div>
      
      <div className="mb-2">
        <strong>Session:</strong> {session ? 'Valid' : 'None'}
      </div>
      
      <div className="mb-2">
        <strong>Auth Error:</strong> {authError || 'None'}
      </div>
      
      <div className="mb-2">
        <strong>Match:</strong> {
          dbUser && authUser && dbUser.auth_id === authUser.id ? 'YES' : 'NO'
        }
      </div>
    </div>
  );
}