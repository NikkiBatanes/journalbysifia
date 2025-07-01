import React, { createContext, useContext, useState } from 'react';

interface ScrollContextType {
  isScrollingDown: boolean;
  setIsScrollingDown: (value: boolean) => void;
  showTabBar: boolean;
  setShowTabBar: (value: boolean) => void;
}

const ScrollContext = createContext<ScrollContextType | undefined>(undefined);

export const ScrollProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isScrollingDown, setIsScrollingDown] = useState(false);
  const [showTabBar, setShowTabBar] = useState(true);

  return (
    <ScrollContext.Provider value={{ isScrollingDown, setIsScrollingDown, showTabBar, setShowTabBar }}>
      {children}
    </ScrollContext.Provider>
  );
};

export const useScroll = () => {
  const context = useContext(ScrollContext);
  if (context === undefined) {
    throw new Error('useScroll must be used within a ScrollProvider');
  }
  return context;
};
