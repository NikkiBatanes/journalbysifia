/**
 * PointsNotificationContext.tsx
 * Global context for managing animated points notifications across the app
 */

import React, { createContext, useContext, useState, useRef, useCallback, ReactNode, useEffect } from 'react';
import { View, StyleSheet, Modal } from 'react-native';
import { v4 as uuidv4 } from 'uuid';
import AnimatedPointsNotification from '../components/ui/AnimatedPointsNotification';
import { notificationService } from '../services/notificationService';
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
    console.log('[PointsNotificationContext] showPointsNotification called:', { points, activityType, position });
    const id = uuidv4();

    const newNotification: PointsNotification = {
      id,
      points,
      activityType,
      position,
    };

    console.log('[PointsNotificationContext] Adding notification:', newNotification);
    setNotifications(prev => {
      console.log('[PointsNotificationContext] Previous notifications:', prev.length);
      const updated = [...prev, newNotification];
      console.log('[PointsNotificationContext] Updated notifications:', updated.length);
      return updated;
    });

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

  // Wire up the global notification service so calls from services trigger this UI
  useEffect(() => {
    console.log('[PointsNotificationContext] Setting up notification callback');
    isMounted.current = true;
    notificationService.setPointsNotificationCallback((points, activityType, position) => {
      console.log('[PointsNotificationContext] Callback triggered:', { points, activityType, position });
      showPointsNotification(points, activityType, position);
    });

    return () => {
      console.log('[PointsNotificationContext] Cleaning up notification callback');
      isMounted.current = false;
      notificationService.clearPointsNotificationCallback();
      // Clear any pending timeouts
      Object.values(timeouts.current).forEach(clearTimeout);
      timeouts.current = {};
    };
  }, [showPointsNotification]);

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

      {/* Global overlay for notifications - render in a transparent Modal to sit above all content/modals */}
      {notifications.length > 0 && (
        <Modal
          visible
          transparent
          statusBarTranslucent
          animationType="none"
          presentationStyle="overFullScreen"
          onShow={() => console.log('[PointsNotificationContext] Overlay Modal shown')}
        >
          <View style={styles.notificationOverlay}>
            {notifications.map((notification) => {
              console.log('[PointsNotificationContext] Rendering notification:', notification);
              return (
                <AnimatedPointsNotification
                  key={notification.id}
                  points={notification.points}
                  activityType={notification.activityType}
                  position={notification.position}
                  visible={true}
                  onAnimationComplete={() => handleAnimationComplete(notification.id)}
                />
              );
            })}
          </View>
        </Modal>
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
