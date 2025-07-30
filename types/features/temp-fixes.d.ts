
// Temporary type declarations to resolve migration issues
declare module '@/hooks/useWolfpackRealtime' {
  export const useWolfpackRealtimeFixed: any;
}

// Extend global types for RPC functions
declare global {
  namespace Supabase {
    interface Functions {
      check_user_membership: any;
      leave_wolfpack: any;
    }
  }
}

export {};
