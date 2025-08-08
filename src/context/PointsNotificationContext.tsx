/**
 * PointsNotificationContext.tsx
 * Global context for managing animated points notifications across the app
 */

import React, { createContext, useContext, useState, useRef, useCallback, ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { v4 as uuidv4 } from 'uuid';
import AnimatedPointsNotification from '../components/ui/AnimatedPointsNotification';
// Removed unused imports: useEffect, useCallback, Animated, Easing, StyleProp, ViewStyle, notificationService

interface PointsNotification {
  id: string;
  points: number;
  activityType: string;
  position?: 'top' | 'center' | 'bottom';
}

interface PointsNotificationContextType {
  showPointsNotification: (points: number, activityType: string, position?: 'top' | 'center' | 'bottom') => void;
}

const PointsNotificationContext = createContext<PointsNotificationContextType | undefined>(undefined);

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

interface PointsNotificationProviderProps {
  children: ReactNode;
}

export const PointsNotificationProvider: React.FC<PointsNotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<PointsNotification[]>([]);
  const isMounted = useRef(true);
  const timeouts = useRef<Record<string, NodeJS.Timeout>>({});

  // Define showPointsNotification first to avoid reference issues
  const showPointsNotification = useCallback((points: number, activityType: string, position: 'top' | 'center' | 'bottom' = 'center') => {
    const id = uuidv4();

    const newNotification: PointsNotification = {
      id,
      points,
      activityType,
      position,
    };

    setNotifications(prev => [...prev, newNotification]);

    // Store timeout reference for cleanup
    timeouts.current[id] = setTimeout(() => {
      if (isMounted.current) {
        setNotifications(prev => prev.filter(n => n.id !== id));
        delete timeouts.current[id];
      }
    }, 3000);

    return () => {
      if (timeouts.current[id]) {
        clearTimeout(timeouts.current[id]);
        delete timeouts.current[id];
      }
    };
  }, []);

  const handleAnimationComplete = useCallback((id: string) => {
    if (!isMounted.current) {return;}

    // Use requestAnimationFrame to defer the state update
    requestAnimationFrame(() => {
      if (isMounted.current) {
        setNotifications(prev => prev.filter(n => n.id !== id));

        // Clear any pending timeout for this notification
        if (timeouts.current[id]) {
          clearTimeout(timeouts.current[id]);
          delete timeouts.current[id];
        }
      }
    });
  }, []);

  return (
    <PointsNotificationContext.Provider value={{ showPointsNotification }}>
      {children}

      {/* Global overlay for notifications - positioned outside normal flow */}
      {notifications.length > 0 && (
        <View
          style={styles.notificationOverlay}
        >
          {notifications.map((notification) => (
            <AnimatedPointsNotification
              key={notification.id}
              points={notification.points}
              activityType={notification.activityType}
              position={notification.position}
              visible={true}
              onAnimationComplete={() => handleAnimationComplete(notification.id)}
            />
          ))}
        </View>
      )}
    </PointsNotificationContext.Provider>
  );
};

export const usePointsNotification = (): PointsNotificationContextType => {
  const context = useContext(PointsNotificationContext);
  if (!context) {
    throw new Error('usePointsNotification must be used within a PointsNotificationProvider');
  }
  return context;
};
