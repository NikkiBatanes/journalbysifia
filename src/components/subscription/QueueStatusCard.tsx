/**
 * Queue Status Card Component
 * Shows generation queue status with beautiful animations
 * Provides simple, user-friendly feedback during generation
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { enhancedGenerationService } from '../../services/enhancedGenerationService';

interface QueueStatusCardProps {
  queueId: string;
  type: 'playbook' | 'devotional';
  onComplete?: (resultId: string) => void;
  onCancel?: () => void;
  onError?: (error: string) => void;
  intelligenceEnabled?: boolean;
}

type QueueStatus = 'pending' | 'processing' | 'completed' | 'failed';

export const QueueStatusCard: React.FC<QueueStatusCardProps> = ({
  queueId,
  type,
  onComplete,
  onCancel,
  onError,
  intelligenceEnabled = false
}) => {
  const [status, setStatus] = useState<QueueStatus>('pending');
  const [message, setMessage] = useState('');
  const [estimatedWaitTime, setEstimatedWaitTime] = useState<number>(0);
  const [processingTime, setProcessingTime] = useState<number>(0);
  const [resultId, setResultId] = useState<string>('');
  
  // Animation values
  const [pulseAnim] = useState(new Animated.Value(1));
  const [progressAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    // Start polling for status updates
    const pollInterval = setInterval(checkStatus, 2000); // Check every 2 seconds
    
    // Start pulse animation
    startPulseAnimation();
    
    return () => {
      clearInterval(pollInterval);
      pulseAnim.stopAnimation();
      progressAnim.stopAnimation();
    };
  }, [queueId]);

  const checkStatus = async () => {
    try {
      const statusData = await enhancedGenerationService.checkGenerationStatus(queueId);
      
      setStatus(statusData.status);
      setMessage(statusData.message);
      setEstimatedWaitTime(statusData.estimatedWaitTime || 0);
      setProcessingTime(statusData.processingTimeSeconds || 0);
      
      if (statusData.status === 'completed' && statusData.resultId) {
        setResultId(statusData.resultId);
        onComplete?.(statusData.resultId);
        stopAnimations();
      } else if (statusData.status === 'failed') {
        onError?.(statusData.message);
        stopAnimations();
      } else if (statusData.status === 'processing') {
        startProgressAnimation();
      }
    } catch (error) {
      console.error('Error checking queue status:', error);
      setStatus('failed');
      setMessage('Error checking status');
      onError?.('Error checking generation status');
    }
  };

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const startProgressAnimation = () => {
    Animated.loop(
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: false,
      })
    ).start();
  };

  const stopAnimations = () => {
    pulseAnim.stopAnimation();
    progressAnim.stopAnimation();
  };

  const handleCancel = async () => {
    try {
      const cancelled = await enhancedGenerationService.cancelGeneration(queueId, 'current-user-id'); // You'd get this from auth context
      if (cancelled) {
        onCancel?.();
      }
    } catch (error) {
      console.error('Error cancelling generation:', error);
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'pending':
        return 'time-outline';
      case 'processing':
        return 'cog-outline';
      case 'completed':
        return 'checkmark-circle';
      case 'failed':
        return 'alert-circle';
      default:
        return 'time-outline';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'pending':
        return ['#3B82F6', '#1D4ED8'];
      case 'processing':
        return ['#F59E0B', '#D97706'];
      case 'completed':
        return ['#10B981', '#059669'];
      case 'failed':
        return ['#EF4444', '#DC2626'];
      default:
        return ['#6B7280', '#4B5563'];
    }
  };

  const formatWaitTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.ceil(seconds / 60);
    return `${minutes}m`;
  };

  const contentType = type === 'playbook' ? 'Playbook' : 'Devotional';
  const colors = getStatusColor();

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[...colors, colors[0] + '20']}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Animated.View style={[styles.iconContainer, { transform: [{ scale: pulseAnim }] }]}>
              <Ionicons name={getStatusIcon()} size={24} color="white" />
            </Animated.View>
            <View style={styles.titleText}>
              <Text style={styles.title}>
                {contentType} Generation
              </Text>
              {intelligenceEnabled && (
                <View style={styles.intelligenceBadge}>
                  <Ionicons name="sparkles" size={12} color="#7C3AED" />
                  <Text style={styles.intelligenceText}>AI Enhanced</Text>
                </View>
              )}
            </View>
          </View>
          
          {(status === 'pending' || status === 'processing') && (
            <TouchableOpacity onPress={handleCancel} style={styles.cancelButton}>
              <Ionicons name="close" size={20} color="white" />
            </TouchableOpacity>
          )}
        </View>

        {/* Status Message */}
        <Text style={styles.message}>{message}</Text>

        {/* Progress Indicator */}
        {status === 'processing' && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            </View>
            <ActivityIndicator size="small" color="white" style={styles.spinner} />
          </View>
        )}

        {/* Wait Time */}
        {status === 'pending' && estimatedWaitTime > 0 && (
          <View style={styles.waitTimeContainer}>
            <Ionicons name="time" size={16} color="white" />
            <Text style={styles.waitTimeText}>
              Estimated wait: {formatWaitTime(estimatedWaitTime)}
            </Text>
          </View>
        )}

        {/* Processing Time */}
        {status === 'completed' && processingTime > 0 && (
          <View style={styles.processingTimeContainer}>
            <Ionicons name="flash" size={16} color="white" />
            <Text style={styles.processingTimeText}>
              Generated in {processingTime}s
            </Text>
          </View>
        )}

        {/* Queue Position Indicator */}
        {status === 'pending' && (
          <View style={styles.queueIndicator}>
            <View style={styles.queueDots}>
              {[1, 2, 3].map((dot, index) => (
                <Animated.View
                  key={dot}
                  style={[
                    styles.queueDot,
                    {
                      opacity: pulseAnim.interpolate({
                        inputRange: [1, 1.1],
                        outputRange: [0.5 + (index * 0.2), 1],
                      }),
                    },
                  ]}
                />
              ))}
            </View>
            <Text style={styles.queueText}>In queue...</Text>
          </View>
        )}

        {/* Success Actions */}
        {status === 'completed' && (
          <TouchableOpacity style={styles.viewButton} onPress={() => onComplete?.(resultId)}>
            <Text style={styles.viewButtonText}>View {contentType}</Text>
            <Ionicons name="arrow-forward" size={16} color="white" />
          </TouchableOpacity>
        )}

        {/* Error Actions */}
        {status === 'failed' && (
          <TouchableOpacity style={styles.retryButton} onPress={() => window.location.reload()}>
            <Ionicons name="refresh" size={16} color="white" />
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        )}
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  gradient: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  titleText: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 2,
  },
  intelligenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  intelligenceText: {
    fontSize: 10,
    color: '#7C3AED',
    fontWeight: '500',
    marginLeft: 2,
  },
  cancelButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    fontSize: 16,
    color: 'white',
    marginBottom: 16,
    opacity: 0.9,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    overflow: 'hidden',
    marginRight: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: 'white',
    borderRadius: 2,
  },
  spinner: {
    marginLeft: 8,
  },
  waitTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  waitTimeText: {
    fontSize: 14,
    color: 'white',
    marginLeft: 6,
    opacity: 0.9,
  },
  processingTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  processingTimeText: {
    fontSize: 14,
    color: 'white',
    marginLeft: 6,
    opacity: 0.9,
  },
  queueIndicator: {
    alignItems: 'center',
    marginBottom: 8,
  },
  queueDots: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  queueDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'white',
    marginHorizontal: 2,
  },
  queueText: {
    fontSize: 12,
    color: 'white',
    opacity: 0.8,
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 8,
  },
  viewButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginRight: 8,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginLeft: 8,
  },
});

// Compact version for smaller spaces
export const CompactQueueStatus: React.FC<{
  queueId: string;
  type: 'playbook' | 'devotional';
  onComplete?: (resultId: string) => void;
}> = ({ queueId, type, onComplete }) => {
  const [status, setStatus] = useState<QueueStatus>('pending');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const pollInterval = setInterval(async () => {
      try {
        const statusData = await enhancedGenerationService.checkGenerationStatus(queueId);
        setStatus(statusData.status);
        setMessage(statusData.message);
        
        if (statusData.status === 'completed' && statusData.resultId) {
          onComplete?.(statusData.resultId);
          clearInterval(pollInterval);
        }
      } catch (error) {
        console.error('Error checking status:', error);
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [queueId]);

  const getStatusColor = () => {
    switch (status) {
      case 'pending': return '#3B82F6';
      case 'processing': return '#F59E0B';
      case 'completed': return '#10B981';
      case 'failed': return '#EF4444';
      default: return '#6B7280';
    }
  };

  return (
    <View style={[compactStyles.container, { borderColor: getStatusColor() }]}>
      <View style={compactStyles.content}>
        <ActivityIndicator size="small" color={getStatusColor()} />
        <Text style={[compactStyles.text, { color: getStatusColor() }]}>
          {status === 'pending' ? 'Queued' : 
           status === 'processing' ? 'Generating' :
           status === 'completed' ? 'Done' : 'Failed'}
        </Text>
      </View>
    </View>
  );
};

const compactStyles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    backgroundColor: '#F9FAFB',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  text: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 6,
  },
});
