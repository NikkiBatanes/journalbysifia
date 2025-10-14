import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { Colors } from '../../theme/colors';

interface TrialDebugMenuProps {
  onRefresh?: () => void;
}

/**
 * DEBUG COMPONENT - Remove before production
 * Allows testing different trial states without manually editing database
 */
export const TrialDebugMenu: React.FC<TrialDebugMenuProps> = ({ onRefresh }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const setTrialState = async (daysRemaining: number) => {
    if (!user?.id) {
      Alert.alert('Error', 'No user found');
      return;
    }

    setLoading(true);
    try {
      const newEndDate = new Date();
      newEndDate.setDate(newEndDate.getDate() + daysRemaining);

      const { error } = await supabase
        .from('user_subscriptions_new')
        .update({
          trial_end_date: newEndDate.toISOString(),
        })
        .eq('user_id', user.id);

      if (error) throw error;

      // Trigger refresh if callback provided
      if (onRefresh) {
        setTimeout(() => onRefresh(), 500);
      }

      Alert.alert('Success', `Trial set to ${daysRemaining} day(s) remaining. ${onRefresh ? 'Refreshing...' : 'Pull down to refresh.'}`);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const convertToPaid = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'No user found');
      return;
    }

    setLoading(true);
    try {
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);

      const { error } = await supabase
        .from('user_subscriptions_new')
        .update({
          tier: 'growth',
          status: 'active',
          trial_end_date: yesterday.toISOString(),
          subscription_start_date: now.toISOString(),
          subscription_display_name: 'siFia Growth',
          playbooks_limit: 20,
          devotionals_limit: 20,
          playbooks_used: 0,
          devotionals_used: 0,
        })
        .eq('user_id', user.id);

      if (error) throw error;

      // Trigger refresh if callback provided (longer delay for tier change)
      if (onRefresh) {
        setTimeout(() => onRefresh(), 1000);
      }

      Alert.alert('Success', `Converted to paid Growth plan (20/20). ${onRefresh ? 'Refreshing...' : 'Pull down to refresh.'}`);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetToTrial = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'No user found');
      return;
    }

    setLoading(true);
    try {
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 3);

      const { error } = await supabase
        .from('user_subscriptions_new')
        .update({
          tier: 'free_trial',
          status: 'active',
          trial_start_date: new Date().toISOString(),
          trial_end_date: trialEnd.toISOString(),
          trial_chosen_tier: 'growth',
          subscription_display_name: 'siFia Growth Trial',
          playbooks_limit: 2,
          devotionals_limit: 2,
          playbooks_used: 0,
          devotionals_used: 0,
        })
        .eq('user_id', user.id);

      if (error) throw error;

      // Trigger refresh if callback provided (longer delay for tier change)
      if (onRefresh) {
        setTimeout(() => onRefresh(), 1000);
      }

      Alert.alert('Success', `Reset to 3-day Growth trial (2/2). ${onRefresh ? 'Refreshing...' : 'Pull down to refresh.'}`);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const setUsage = async (playbooksUsed: number, devotionalsUsed: number) => {
    if (!user?.id) {
      Alert.alert('Error', 'No user found');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('user_subscriptions_new')
        .update({
          playbooks_used: playbooksUsed,
          devotionals_used: devotionalsUsed,
        })
        .eq('user_id', user.id);

      if (error) throw error;

      if (onRefresh) {
        setTimeout(() => onRefresh(), 500);
      }

      Alert.alert('Success', `Usage set to ${playbooksUsed} playbooks, ${devotionalsUsed} devotionals. ${onRefresh ? 'Refreshing...' : 'Pull down to refresh.'}`);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const changeTier = async (tier: string, tierName: string, playbooksLimit: number, devotionalsLimit: number) => {
    if (!user?.id) {
      Alert.alert('Error', 'No user found');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('user_subscriptions_new')
        .update({
          tier,
          status: 'active',
          subscription_display_name: tierName,
          playbooks_limit: playbooksLimit,
          devotionals_limit: devotionalsLimit,
          playbooks_used: 0,
          devotionals_used: 0,
        })
        .eq('user_id', user.id);

      if (error) throw error;

      if (onRefresh) {
        setTimeout(() => onRefresh(), 1000);
      }

      Alert.alert('Success', `Changed to ${tierName}. ${onRefresh ? 'Refreshing...' : 'Pull down to refresh.'}`);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔧 Trial Debug Menu</Text>
      <Text style={styles.warning}>⚠️ DEV ONLY - Remove before production</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Set Trial Days Remaining:</Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, styles.buttonSmall]}
            onPress={() => setTrialState(3)}
            disabled={loading}
          >
            <Text style={styles.buttonText}>3 Days</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.buttonSmall]}
            onPress={() => setTrialState(2)}
            disabled={loading}
          >
            <Text style={styles.buttonText}>2 Days</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.buttonSmall]}
            onPress={() => setTrialState(1)}
            disabled={loading}
          >
            <Text style={styles.buttonText}>1 Day</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Conversion Scenarios:</Text>
        <TouchableOpacity
          style={[styles.button, styles.buttonPrimary]}
          onPress={convertToPaid}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Convert to Paid (20/20)</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.buttonSecondary]}
          onPress={resetToTrial}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Reset to Trial (2/2)</Text>
        </TouchableOpacity>
      </View>

      {/* Advanced Options Toggle */}
      <TouchableOpacity
        style={styles.advancedToggle}
        onPress={() => setShowAdvanced(!showAdvanced)}
        disabled={loading}
      >
        <Text style={styles.advancedToggleText}>
          {showAdvanced ? '▼' : '▶'} Advanced Options
        </Text>
      </TouchableOpacity>

      {showAdvanced && (
        <>
          {/* Set Usage */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Set Usage (Playbooks / Devotionals):</Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, styles.buttonSmall]}
                onPress={() => setUsage(0, 0)}
                disabled={loading}
              >
                <Text style={styles.buttonText}>0 / 0</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.buttonSmall]}
                onPress={() => setUsage(1, 1)}
                disabled={loading}
              >
                <Text style={styles.buttonText}>1 / 1</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.buttonSmall]}
                onPress={() => setUsage(2, 2)}
                disabled={loading}
              >
                <Text style={styles.buttonText}>2 / 2</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.buttonRow, { marginTop: 8 }]}>
              <TouchableOpacity
                style={[styles.button, styles.buttonSmall]}
                onPress={() => setUsage(5, 5)}
                disabled={loading}
              >
                <Text style={styles.buttonText}>5 / 5</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.buttonSmall]}
                onPress={() => setUsage(10, 10)}
                disabled={loading}
              >
                <Text style={styles.buttonText}>10 / 10</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.buttonSmall]}
                onPress={() => setUsage(20, 20)}
                disabled={loading}
              >
                <Text style={styles.buttonText}>20 / 20</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Change Tier */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Change Tier:</Text>
            <TouchableOpacity
              style={[styles.button, { marginBottom: 8 }]}
              onPress={() => changeTier('seeker', 'siFia Seeker', 0, 0)}
              disabled={loading}
            >
              <Text style={styles.buttonText}>Seeker (0/0)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, { marginBottom: 8 }]}
              onPress={() => changeTier('spark', 'siFia Spark', 8, 8)}
              disabled={loading}
            >
              <Text style={styles.buttonText}>Spark (8/8)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, { marginBottom: 8 }]}
              onPress={() => changeTier('growth', 'siFia Growth', 20, 20)}
              disabled={loading}
            >
              <Text style={styles.buttonText}>Growth (20/20)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, { marginBottom: 8 }]}
              onPress={() => changeTier('transformation', 'siFia Transformation', -1, -1)}
              disabled={loading}
            >
              <Text style={styles.buttonText}>Transformation (Unlimited)</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      <Text style={styles.note}>
        💡 After changing state, the screen will auto-refresh.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.modalBlue,
    padding: 16,
    margin: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.alertCoral,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
    marginBottom: 4,
  },
  warning: {
    fontSize: 12,
    color: Colors.alertCoral,
    marginBottom: 16,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.hopeWhite,
    marginBottom: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    backgroundColor: Colors.anchorBlue,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.hopeWhite,
  },
  buttonSmall: {
    flex: 1,
  },
  buttonPrimary: {
    backgroundColor: Colors.growthGreen,
    marginBottom: 8,
  },
  buttonSecondary: {
    backgroundColor: Colors.alertCoral,
  },
  buttonText: {
    color: Colors.hopeWhite,
    fontSize: 14,
    fontWeight: '600',
  },
  note: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    fontStyle: 'italic',
    marginTop: 8,
  },
  advancedToggle: {
    padding: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  advancedToggleText: {
    color: Colors.hopeWhite,
    fontSize: 14,
    fontWeight: '600',
  },
});
