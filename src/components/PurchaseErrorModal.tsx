/**
 * ENTERPRISE IMPROVEMENT: Purchase Error Modal
 *
 * Explanation: This modal provides clear, actionable error messages.
 * Benefits:
 * - User-friendly error messages (not technical jargon)
 * - Specific guidance for each error type
 * - Retry button for transient errors
 * - Contact support option
 * - Reduces user frustration and support tickets
 */

import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../theme/ThemeContext';

const { width } = Dimensions.get('window');

interface PurchaseErrorModalProps {
  visible: boolean;
  errorType: 'network' | 'validation' | 'cancelled' | 'unknown';
  errorMessage?: string;
  onRetry: () => void;
  onClose: () => void;
  onContactSupport?: () => void;
}

export const PurchaseErrorModal: React.FC<PurchaseErrorModalProps> = ({
  visible,
  errorType,
  errorMessage,
  onRetry,
  onClose,
  onContactSupport,
}) => {
  const theme = useTheme();
  const paymentProvider = Platform.OS === 'android' ? 'Google Play' : 'Apple';

  const getErrorInfo = () => {
    const errors = {
      network: {
        title: 'Connection Issue',
        description: `We couldn't connect to ${paymentProvider}. Please check your internet connection and try again.`,
        icon: 'cloud-offline-outline',
        color: '#FF9800',
        showRetry: true,
      },
      validation: {
        title: 'Validation Failed',
        description: `We couldn't verify your purchase with ${paymentProvider}. This is usually temporary. Please try again in a moment.`,
        icon: 'alert-circle-outline',
        color: '#F44336',
        showRetry: true,
      },
      cancelled: {
        title: 'Purchase Cancelled',
        description: 'You cancelled the purchase. No charges were made. You can try again whenever you\'re ready.',
        icon: 'close-circle-outline',
        color: '#9E9E9E',
        showRetry: false,
      },
      unknown: {
        title: 'Something Went Wrong',
        description: errorMessage || 'An unexpected error occurred. Please try again or contact support if the problem persists.',
        icon: 'warning-outline',
        color: '#FF5722',
        showRetry: true,
      },
    };

    return errors[errorType] || errors.unknown;
  };

  const errorInfo = getErrorInfo();

  // Compute text color based on errorInfo.showRetry to avoid inline styles
  const closeButtonTextColor = errorInfo.showRetry ? theme.colors.text : '#FFFFFF';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.modalContainer,
            { backgroundColor: theme.colors.cardBackground },
          ]}
        >
          {/* Error Icon */}
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: errorInfo.color + '20' },
            ]}
          >
            <Ionicons name={errorInfo.icon} size={48} color={errorInfo.color} />
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: theme.colors.text }]}>
            {errorInfo.title}
          </Text>

          {/* Description */}
          <Text style={[styles.description, { color: theme.colors.secondaryText }]}>
            {errorInfo.description}
          </Text>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            {errorInfo.showRetry && (
              <TouchableOpacity
                style={[styles.retryButton, { backgroundColor: errorInfo.color }]}
                onPress={onRetry}
                activeOpacity={0.8}
              >
                <Ionicons name="refresh" size={20} color="#FFFFFF" />
                <Text style={styles.retryButtonText}>Try Again</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.closeButton,
                { borderColor: theme.colors.cardBorder },
                !errorInfo.showRetry && { backgroundColor: errorInfo.color },
              ]}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.closeButtonText,
                  { color: closeButtonTextColor },
                ]}
              >
                {errorInfo.showRetry ? 'Cancel' : 'Close'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Support Link */}
          {onContactSupport && errorType !== 'cancelled' && (
            <TouchableOpacity
              style={styles.supportLink}
              onPress={onContactSupport}
              activeOpacity={0.7}
            >
              <Ionicons name="help-circle-outline" size={16} color="#2196F3" />
              <Text style={styles.supportLinkText}>Contact Support</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: width - 60,
    maxWidth: 360,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  closeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    borderWidth: 1,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  supportLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 8,
  },
  supportLinkText: {
    fontSize: 14,
    color: '#2196F3',
    marginLeft: 6,
    fontWeight: '500',
  },
});
