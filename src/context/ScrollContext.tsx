import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ScrollView } from 'react-native';

interface ScrollContextType {
  isScrollingDown: boolean;
  setIsScrollingDown: (value: boolean) => void;
  showTabBar: boolean;
  setShowTabBar: (value: boolean) => void;
  suppressTabBar: boolean;
  setSuppressTabBar: (value: boolean) => void;
  collapsedTabBarCenterY: number | null;
  setCollapsedTabBarCenterY: (value: number | null) => void;
  // New: vertical content scroller control
  setContentScrollRef: (ref: React.RefObject<ScrollView> | React.MutableRefObject<ScrollView | null> | null) => void;
  scrollTo: (y: number, animated?: boolean) => void;
  scrollToTop: (animated?: boolean) => void;
  registerSection: (id: string, y: number) => void;
  scrollToSection: (id: string, offset?: number, animated?: boolean) => void;
}

const ScrollContext = createContext<ScrollContextType | undefined>(undefined);

export const ScrollProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isScrollingDown, setIsScrollingDown] = useState(false);
  const [showTabBar, setShowTabBar] = useState(true);
  const [suppressTabBar, setSuppressTabBar] = useState(false);
  const [collapsedTabBarCenterY, setCollapsedTabBarCenterY] = useState<number | null>(null);
  const contentScrollRefHolder = useRef<React.RefObject<ScrollView> | React.MutableRefObject<ScrollView | null> | null>(null);
  const sectionYRef = useRef<Record<string, number>>({});

  const setContentScrollRef = useCallback((ref: React.RefObject<ScrollView> | React.MutableRefObject<ScrollView | null> | null) => {
    contentScrollRefHolder.current = ref;
  }, []);

  const scrollTo = useCallback((y: number, animated: boolean = true) => {
    try {
      const ref = contentScrollRefHolder.current?.current as any;
      ref?.scrollTo?.({ y: Math.max(0, y), animated });
    } catch {}
  }, []);

  const scrollToTop = useCallback((animated: boolean = true) => scrollTo(0, animated), [scrollTo]);

  const registerSection = useCallback((id: string, y: number) => {
    sectionYRef.current[id] = y;
  }, []);

  const scrollToSection = useCallback((id: string, offset: number = 0, animated: boolean = true) => {
    const baseY = sectionYRef.current[id];
    if (typeof baseY === 'number') {
      scrollTo(Math.max(0, baseY + offset), animated);
    }
  }, [scrollTo]);

  const value = useMemo(() => ({
    isScrollingDown, setIsScrollingDown,
    showTabBar, setShowTabBar,
    suppressTabBar, setSuppressTabBar,
    collapsedTabBarCenterY, setCollapsedTabBarCenterY,
    setContentScrollRef, scrollTo, scrollToTop, registerSection, scrollToSection,
  }), [isScrollingDown, showTabBar, suppressTabBar, collapsedTabBarCenterY, setContentScrollRef, scrollTo, scrollToTop, registerSection, scrollToSection]);

  return (
    <ScrollContext.Provider value={value}>
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
