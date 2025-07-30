'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface CommentsContextType {
  isCommentsOpen: boolean;
  setIsCommentsOpen: (open: boolean) => void;
}

const CommentsContext = createContext<CommentsContextType | undefined>(undefined);

export function CommentsProvider({ children }: { children: ReactNode }) {
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);

  return (
    <CommentsContext.Provider value={{ isCommentsOpen, setIsCommentsOpen }}>
      {children}
    </CommentsContext.Provider>
  );
}

export function useComments() {
  const context = useContext(CommentsContext);
  if (context === undefined) {
    throw new Error('useComments must be used within a CommentsProvider');
  }
  return context;
}