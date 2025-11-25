/**
 * BadgeNotificationContext.tsx
 * Global context for managing animated badge notifications across the app
 */

import React, { createContext, useContext, useState, useRef, useCallback, ReactNode, useEffect } from 'react';
import { View, StyleSheet, Modal } from 'react-native';
import { v4 as uuidv4 } from 'uuid';
import AnimatedBadgeNotification from '../components/ui/AnimatedBadgeNotification';
import { notificationService } from '../services/notificationService';
import { Badge } from '../services/faithPointsService';

interface BadgeNotification {
  id: string;
  badge: Badge;
}

interface BadgeNotificationContextType {
  showBadgeNotification: (badge: Badge) => void;
}

const BadgeNotificationContext = createContext<BadgeNotificationContextType | undefined>(undefined);

const styles = StyleSheet.create({
  notificationOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999999999,
    elevation: 999999999,
    pointerEvents: 'none',
  },
});

interface BadgeNotificationProviderProps {
  children: ReactNode;
}

export const BadgeNotificationProvider: React.FC<BadgeNotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<BadgeNotification[]>([]);
  const isMounted = useRef(true);
  const timeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Define showBadgeNotification first to avoid reference issues
  const showBadgeNotification = useCallback((badge: Badge) => {
    if (!isMounted.current) return;

    const id = uuidv4();
    const newNotification: BadgeNotification = {
      id,
      badge,
    };

    setNotifications(prev => [...prev, newNotification]);

    // Auto-hide after 4 seconds
    const timeout = setTimeout(() => {
      if (isMounted.current) {
        setNotifications(prev => prev.filter(n => n.id !== id));
        delete timeouts.current[id];
      }
    }, 4000);

    timeouts.current[id] = timeout;
  }, []);

  useEffect(() => {
    isMounted.current = true;
    notificationService.setBadgeNotificationCallback((badge: Badge) => {
      showBadgeNotification(badge);
    });

    // Capture current timeouts before cleanup function is created
    const currentTimeouts = timeouts.current;

    return () => {
      isMounted.current = false;
      notificationService.clearBadgeNotificationCallback();
      // Clear any pending timeouts using captured ref value
      Object.values(currentTimeouts).forEach(clearTimeout);
    };
  }, [showBadgeNotification]);

  const handleAnimationComplete = useCallback((id: string) => {
    if (!isMounted.current) return;

    // Capture current timeout value to avoid stale closure
    const currentTimeout = timeouts.current[id];

    // Use requestAnimationFrame to defer the state update
    requestAnimationFrame(() => {
      if (isMounted.current) {
        setNotifications(prev => prev.filter(n => n.id !== id));
        if (currentTimeout) {
          clearTimeout(currentTimeout);
          delete timeouts.current[id];
        }
      }
    });
  }, []);

  return (
    <BadgeNotificationContext.Provider value={{ showBadgeNotification }}>
      {children}
      
      {/* Render notifications */}
      {notifications.map(notification => (
        <AnimatedBadgeNotification
          key={notification.id}
          badge={notification.badge}
          onAnimationComplete={() => handleAnimationComplete(notification.id)}
        />
      ))}
    </BadgeNotificationContext.Provider>
  );
};

export const useBadgeNotification = (): BadgeNotificationContextType => {
  const context = useContext(BadgeNotificationContext);
  if (context === undefined) {
    throw new Error('useBadgeNotification must be used within a BadgeNotificationProvider');
  }
  return context;
};

export default BadgeNotificationContext;
