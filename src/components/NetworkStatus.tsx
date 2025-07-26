/**
 * Network Status Component
 * Shows network connectivity status and sync progress
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
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
  const {
    isOnline,
    isConnected,
    connectionType,
    syncStatus,
    forceSyncNow,
  } = useNetworkState();

  const handleSyncPress = async () => {
    try {
      await forceSyncNow();
    } catch (error) {
      console.error('Manual sync failed:', error);
    }
  };

  // Don't show anything if online and no pending actions
  if (isOnline && syncStatus.pendingActions === 0 && !showDetails) {
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
    <View style={[styles.container, style]}>
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
    backgroundColor: Colors.hopeWhite,
    borderRadius: 8,
    padding: 8,
    marginHorizontal: 16,
    marginVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    fontFamily: Fonts.medium,
    color: Colors.darkGray,
  },
  syncButton: {
    backgroundColor: Colors.anchorBlue,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
  },
  syncButtonText: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: Colors.hopeWhite,
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
    color: Colors.mediumGray,
    marginBottom: 2,
  },
});

export default NetworkStatus;
