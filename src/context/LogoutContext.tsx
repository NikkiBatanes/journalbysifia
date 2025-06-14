import React, { createContext, useContext } from 'react';

export type LogoutContextType = {
  onLogout: () => void;
};

export const LogoutContext = createContext<LogoutContextType | undefined>(undefined);

export const useLogout = () => {
  const context = useContext(LogoutContext);
  if (!context) {
    throw new Error('useLogout must be used within a LogoutContext.Provider');
  }
  return context.onLogout;
};
