/**
 * Network Status Component
 * Shows network connectivity status and sync progress
 */

import React from 'react';
import { Logger } from '../utils/ProductionLogger';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useNetworkState } from '../services/network/networkManager';
import { Colors } from '../theme/colors';
import { Fonts } from '../theme/fonts';

interface NetworkStatusProps {
  showDetails?: boolean;
  style?: any;
}

export const NetworkStatus: React.FC<NetworkStatusProps> = ({
  showDetails = false,
  style,
}) => {
  const insets = useSafeAreaInsets();
  const {
    isOnline,
    isConnected,
    connectionType,
    syncStatus,
    forceSyncNow,
  } = useNetworkState();

  // Don't show offline status immediately - wait a bit to avoid flickering
  const [showOfflineStatus, setShowOfflineStatus] = React.useState(false);
  const [isDismissed, setIsDismissed] = React.useState(false);

  const handleSyncPress = async () => {
    try {
      await forceSyncNow();
    } catch (error) {
      Logger.error('Manual sync failed', error as Error, { component: 'NetworkStatus' });
    }
  };

  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    if (!isOnline) {
      // Show offline status after 1 second delay to avoid brief network hiccups
      timer = setTimeout(() => {
        setShowOfflineStatus(true);
      }, 1000);
    } else {
      // Hide offline status immediately when back online
      setShowOfflineStatus(false);
      setIsDismissed(false);
    }

    return () => {
      if (timer) {clearTimeout(timer);}
    };
  }, [isOnline]);

  // Don't show anything if online and no pending actions
  // Also don't show brief offline states (less than 2 seconds)
  if (isOnline && syncStatus.pendingActions === 0 && !showDetails) {
    return null;
  }

  // Don't render if offline but haven't waited long enough
  if (!isOnline && !showOfflineStatus && !showDetails) {
    return null;
  }

  if (isDismissed && !showDetails) {
    return null;
  }

  const getStatusColor = () => {
    if (!isOnline) {return Colors.alertCoral;}
    if (syncStatus.pendingActions > 0) {return Colors.faithGold;}
    return Colors.growthGreen;
  };

  const getStatusIcon = () => {
    if (!isOnline) {return 'cloud-offline-outline';}
    if (syncStatus.syncInProgress) {return 'sync-outline';}
    if (syncStatus.pendingActions > 0) {return 'cloud-upload-outline';}
    return 'cloud-done-outline';
  };

  const getStatusText = () => {
    if (!isOnline) {return 'Offline';}
    if (syncStatus.syncInProgress) {return 'Syncing...';}
    if (syncStatus.pendingActions > 0) {return `${syncStatus.pendingActions} pending`;}
    return 'Online';
  };

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.container,
        { bottom: Math.max(insets.bottom, 8) + 76 },
        style,
      ]}
    >
      <View style={styles.statusRow}>
        <View style={[styles.statusIndicator, { backgroundColor: getStatusColor() }]}>
          {syncStatus.syncInProgress ? (
            <ActivityIndicator size="small" color={Colors.hopeWhite} />
          ) : (
            <Ionicons
              name={getStatusIcon()}
              size={16}
              color={Colors.hopeWhite}
            />
          )}
        </View>

        <Text style={styles.statusText}>{getStatusText()}</Text>

        {!isOnline && syncStatus.pendingActions > 0 && (
          <TouchableOpacity
            style={styles.syncButton}
            onPress={handleSyncPress}
            disabled={!isOnline || syncStatus.syncInProgress}
          >
            <Text style={styles.syncButtonText}>Sync</Text>
          </TouchableOpacity>
        )}

        {!showDetails && (
          <TouchableOpacity
            accessibilityLabel="Dismiss network status"
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.dismissButton}
            onPress={() => setIsDismissed(true)}
          >
            <Ionicons name="close" size={16} color={Colors.textGray} />
          </TouchableOpacity>
        )}
      </View>

      {showDetails && (
        <View style={styles.detailsContainer}>
          <Text style={styles.detailText}>
            Connection: {connectionType || 'Unknown'}
          </Text>
          <Text style={styles.detailText}>
            Status: {isConnected ? 'Connected' : 'Disconnected'}
          </Text>
          {syncStatus.pendingActions > 0 && (
            <Text style={styles.detailText}>
              Pending actions: {syncStatus.pendingActions}
            </Text>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 1000,
    backgroundColor: Colors.hopeWhite,
    borderRadius: 26,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: '#29342E',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.14,
    shadowRadius: 4,
    elevation: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 28,
  },
  statusIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  statusText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: Fonts.medium,
    color: Colors.darkGray,
  },
  syncButton: {
    backgroundColor: Colors.sage,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
  },
  syncButtonText: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: Colors.hopeWhite,
  },
  dismissButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    backgroundColor: 'rgba(3,32,61,0.06)',
  },
  detailsContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.lightGray,
  },
  detailText: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: Colors.textGray,
    marginBottom: 2,
  },
});

export default NetworkStatus;
