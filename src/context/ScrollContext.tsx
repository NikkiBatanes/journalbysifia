import React, { createContext, useContext, useRef, useState } from 'react';
import type { ScrollView } from 'react-native';

interface ScrollContextType {
  isScrollingDown: boolean;
  setIsScrollingDown: (value: boolean) => void;
  showTabBar: boolean;
  setShowTabBar: (value: boolean) => void;
  // New: vertical content scroller control
  setContentScrollRef: (ref: React.RefObject<ScrollView> | null) => void;
  scrollTo: (y: number, animated?: boolean) => void;
  scrollToTop: (animated?: boolean) => void;
  registerSection: (id: string, y: number) => void;
  scrollToSection: (id: string, offset?: number, animated?: boolean) => void;
}

const ScrollContext = createContext<ScrollContextType | undefined>(undefined);

export const ScrollProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isScrollingDown, setIsScrollingDown] = useState(false);
  const [showTabBar, setShowTabBar] = useState(true);
  const contentScrollRefHolder = useRef<React.RefObject<ScrollView> | null>(null);
  const sectionYRef = useRef<Record<string, number>>({});

  const setContentScrollRef = (ref: React.RefObject<ScrollView> | null) => {
    contentScrollRefHolder.current = ref;
  };

  const scrollTo = (y: number, animated: boolean = true) => {
    try {
      const ref = contentScrollRefHolder.current?.current as any;
      ref?.scrollTo?.({ y: Math.max(0, y), animated });
    } catch {}
  };

  const scrollToTop = (animated: boolean = true) => scrollTo(0, animated);

  const registerSection = (id: string, y: number) => {
    sectionYRef.current[id] = y;
  };

  const scrollToSection = (id: string, offset: number = 0, animated: boolean = true) => {
    const baseY = sectionYRef.current[id];
    if (typeof baseY === 'number') {
      scrollTo(Math.max(0, baseY + offset), animated);
    }
  };

  return (
    <ScrollContext.Provider value={{ isScrollingDown, setIsScrollingDown, showTabBar, setShowTabBar, setContentScrollRef, scrollTo, scrollToTop, registerSection, scrollToSection }}>
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
