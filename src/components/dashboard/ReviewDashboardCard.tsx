import React from 'react';
import {StyleSheet, TouchableOpacity, View} from 'react-native';
import {ArrowRight} from 'lucide-react-native';

import ThemedText from '../common/ThemedText';
import {Colors} from '../../theme/colors';
import {triggerLightHaptic} from '../../utils/haptics';

interface Props {
  eyebrow: string;
  title: string;
  description: string;
  periodLabel: string;
  actionLabel: string;
  stats: React.ReactNode;
  footer?: React.ReactNode;
  alsoReady?: string;
  onBegin: () => void;
}

const ReviewDashboardCard = ({
  eyebrow,
  title,
  description,
  periodLabel,
  actionLabel,
  stats,
  footer,
  alsoReady,
  onBegin,
}: Props) => (
  <View style={styles.card}>
    <View style={styles.columns}>
      <View style={styles.copy}>
        <ThemedText weight="semiBold" style={styles.eyebrow}>{eyebrow}</ThemedText>
        <ThemedText weight="semiBold" style={styles.title}>{title}</ThemedText>
        <ThemedText style={styles.description}>{description}</ThemedText>
        <ThemedText style={styles.period}>{periodLabel}</ThemedText>
        <TouchableOpacity
          style={styles.begin}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          activeOpacity={0.8}
          onPress={() => {
            triggerLightHaptic();
            onBegin();
          }}
        >
          <ThemedText weight="semiBold" style={styles.beginText}>{actionLabel}</ThemedText>
          <ArrowRight size={16} color={Colors.hopeWhite} />
        </TouchableOpacity>
      </View>
      <View style={styles.stats}>{stats}</View>
    </View>
    {footer}
    {alsoReady ? <ThemedText style={styles.note}>Also ready: {alsoReady}</ThemedText> : null}
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.sage,
    borderColor: Colors.sage,
    borderWidth: 1,
    borderRadius: 24,
    padding: 20,
    marginBottom: 8,
  },
  columns: {flexDirection: 'row'},
  copy: {flex: 1.45, minWidth: 0, paddingRight: 15},
  eyebrow: {color: Colors.hopeWhite, fontSize: 10, lineHeight: 16, letterSpacing: 1.8},
  title: {color: Colors.hopeWhite, fontSize: 24, lineHeight: 32, marginTop: 14},
  description: {color: Colors.hopeWhite, fontSize: 12, lineHeight: 19, marginTop: 12},
  period: {color: Colors.hopeWhite, opacity: 0.85, fontSize: 12, lineHeight: 19, marginTop: 3},
  stats: {
    flex: 1,
    minWidth: 0,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.3)',
    paddingLeft: 16,
  },
  begin: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderColor: 'rgba(255,255,255,0.3)',
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 17,
  },
  beginText: {color: Colors.hopeWhite, fontSize: 12, lineHeight: 18, flexShrink: 1},
  note: {color: Colors.hopeWhite, opacity: 0.85, fontSize: 11, lineHeight: 18, marginTop: 12},
});

export default ReviewDashboardCard;
