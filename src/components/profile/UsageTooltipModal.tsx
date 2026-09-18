import React from 'react';
import { Modal, StyleSheet, TouchableOpacity } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors } from '../../theme/colors';
import ThemedText from '../common/ThemedText';
import { triggerLightHaptic } from '../../utils/haptics';

export type TooltipType = 'wisdom' | 'faithPoints' | 'badges';

interface Props {
  visible: boolean;
  type: TooltipType | null;
  onClose: () => void;
  subscription: any;
  usage: { wisdom: { used: number; limit: number } } | null;
  stats: { faithPoints: number; level: number; badgesCount?: number } | null;
}

const UsageTooltipModal: React.FC<Props> = ({ visible, type, onClose, subscription, usage, stats }) => {
  if (!visible || !type) { return null; }
  const content = type === 'wisdom'
    ? {
        title: 'Faithful Action How-Tos', icon: 'lightbulb',
        description: `How-Tos provide personalized, step-by-step guidance for faithful actions. You are on ${subscription?.subscription_display_name || 'your plan'}. ${usage?.wisdom.limit === -1 ? 'This plan does not use a monthly How-To counter.' : `${usage?.wisdom.used || 0} of ${usage?.wisdom.limit || 0} used this month.`}`,
      }
    : type === 'faithPoints'
      ? { title: 'Faith Points', icon: 'star-four-points', description: `You currently have ${stats?.faithPoints || 0} Faith Points.` }
      : { title: 'Badges', icon: 'trophy', description: `You have earned ${stats?.badgesCount || 0} badge${stats?.badgesCount === 1 ? '' : 's'}.` };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.card} activeOpacity={1}>
          <MaterialCommunityIcons name={content.icon} size={28} color={Colors.alertCoral} />
          <ThemedText weight="bold" style={styles.title}>{content.title}</ThemedText>
          <ThemedText style={styles.description}>{content.description}</ThemedText>
          <TouchableOpacity style={styles.closeButton} onPress={() => { try { triggerLightHaptic(); } catch {} onClose(); }}>
            <ThemedText weight="semiBold" style={styles.closeText}>Close</ThemedText>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 420, borderRadius: 20, backgroundColor: Colors.hopeWhite, padding: 24, alignItems: 'center' },
  title: { marginTop: 12, fontSize: 20, color: Colors.text },
  description: { marginTop: 12, lineHeight: 22, textAlign: 'center', color: Colors.textGray },
  closeButton: { marginTop: 20, borderRadius: 12, backgroundColor: Colors.sage, paddingHorizontal: 28, paddingVertical: 12 },
  closeText: { color: Colors.hopeWhite },
});

export default UsageTooltipModal;
