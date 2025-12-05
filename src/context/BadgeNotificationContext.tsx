/**
 * BadgeNotificationContext.tsx
 * Global context for managing animated badge notifications across the app
 */

import React, { createContext, useContext, useState, useRef, useCallback, ReactNode, useEffect } from 'react';
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
  notifications: BadgeNotification[];
}

const BadgeNotificationContext = createContext<BadgeNotificationContextType | undefined>(undefined);

interface BadgeNotificationProviderProps {
  children: ReactNode;
}

export const BadgeNotificationProvider: React.FC<BadgeNotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<BadgeNotification[]>([]);
  const isMounted = useRef(true);
  const notificationTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Define showBadgeNotification first to avoid reference issues
  const showBadgeNotification = useCallback((badge: Badge) => {
    if (!isMounted.current) {return;}

    const id = uuidv4();
    const newNotification: BadgeNotification = {
      id,
      badge,
    };

    setNotifications(prev => [...prev, newNotification]);

    const timeout = setTimeout(() => {
      if (isMounted.current) {
        setNotifications(prev => prev.filter(n => n.id !== id));
        notificationTimeouts.current.delete(id);
      }
    }, 5000);

    notificationTimeouts.current.set(id, timeout);
  }, []);

  useEffect(() => {
    isMounted.current = true;
    const currentTimeouts = notificationTimeouts.current;
    notificationService.setBadgeNotificationCallback((badge: Badge) => {
      showBadgeNotification(badge);
    });

    return () => {
      isMounted.current = false;
      notificationService.clearBadgeNotificationCallback();
      // Clear any pending timeouts
      currentTimeouts.forEach(timeout => clearTimeout(timeout));
      currentTimeouts.clear();
    };
  }, [showBadgeNotification]);

  const handleAnimationComplete = useCallback((id: string) => {
    if (!isMounted.current) {return;}

    // Schedule state update for next tick to avoid useInsertionEffect warning
    // This prevents scheduling updates during the animation completion phase
    requestAnimationFrame(() => {
      if (!isMounted.current) {return;}

      setNotifications(prev => prev.filter(n => n.id !== id));

      // Clear the timeout for this notification
      const timeout = notificationTimeouts.current.get(id);
      if (timeout) {
        clearTimeout(timeout);
        notificationTimeouts.current.delete(id);
      }
    });
  }, []);

  const contextValue: BadgeNotificationContextType = {
    showBadgeNotification,
    notifications,
  };

  return (
    <BadgeNotificationContext.Provider value={contextValue}>
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
