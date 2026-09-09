import React, { useState } from 'react';
import { Alert, LayoutAnimation, Share, StyleSheet, TouchableOpacity, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ThemedText from './common/ThemedText';
import type { TruthScreenEnhancement } from '../../supabase/functions/_shared/truthScreenEnhancement';
import { triggerLightHaptic } from '../utils/haptics';
import ShareableSelectableText from './ShareableSelectableText';

interface TruthScreenElementProps {
  element: TruthScreenEnhancement;
  onShare?: (text: string, options?: { noSplit?: boolean }) => void;
}

export default function TruthScreenElement({ element, onShare }: TruthScreenElementProps) {
  const [expanded, setExpanded] = useState(false);
  const share = async (textToShare: string, options?: { noSplit?: boolean }) => {
    triggerLightHaptic();
    if (onShare) {
      onShare(textToShare, options);
      return;
    }
    try {
      await Share.share({ message: `${textToShare}\n\n— siFia reflection` });
    } catch {
      Alert.alert('Unable to share', 'Please try again.');
    }
  };

  if (element.kind === 'explanation') {
    return (
      <View style={styles.card}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          onPress={() => {
            if (!expanded) {
              triggerLightHaptic();
            }
            LayoutAnimation.configureNext({
              duration: expanded ? 160 : 220,
              update: { type: LayoutAnimation.Types.easeInEaseOut },
              create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
            });
            setExpanded(value => !value);
          }}
          style={styles.header}
        >
          <ThemedText selectable weight="semiBold" style={styles.label}>A closer look</ThemedText>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color="#B99562" />
        </TouchableOpacity>
        {expanded ? <ShareableSelectableText text={element.text} style={styles.body} onShare={share} /> : null}
      </View>
    );
  }

  const inferredEntrustIndex = element.kind === 'comparison'
    ? element.items.findIndex(item => /\b(?:entrust|release|surrender|beyond (?:your )?control)\b/i.test(item))
    : -1;
  const comparisonLabels = element.kind === 'comparison' && element.labels?.length === 2
    ? element.labels
    : inferredEntrustIndex >= 0
      ? element.items.map((_, index) => index === inferredEntrustIndex ? 'WHAT YOU CAN ENTRUST' : 'YOUR RESPONSIBILITY')
      : ['ONE TRUTH', 'ANOTHER TRUTH'];
  const compoundShareText = element.kind === 'flow'
    ? element.items.join('\n\n↓\n\n')
    : element.kind === 'comparison'
      ? element.items.map((item, index) => `${comparisonLabels[index]}\n${item}`).join('\n\n◇\n\n')
      : '';

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <ThemedText selectable weight="semiBold" style={styles.label}>
          {element.kind === 'takeaway' ? 'A thought to carry' : element.kind === 'flow' ? 'See the progression' : 'Notice the distinction'}
        </ThemedText>
        {element.kind === 'flow' || element.kind === 'comparison' ? (
          <TouchableOpacity
            style={styles.share}
            onPress={() => share(compoundShareText, { noSplit: true })}
            activeOpacity={0.72}
            accessibilityRole="button"
            accessibilityLabel={element.kind === 'flow' ? 'Share this progression' : 'Share this distinction'}
          >
            <Ionicons name="paper-plane-outline" size={13} color="#B99562" />
          </TouchableOpacity>
        ) : null}
      </View>
      {element.kind === 'takeaway' ? (
        <>
          <ShareableSelectableText text={element.text} weight="semiBold" style={styles.body} onShare={share} />
          <ThemedText selectable style={styles.attribution}>siFia reflection</ThemedText>
        </>
      ) : element.kind === 'comparison' ? (
        <View style={styles.comparisonStack}>
          {element.items.map((item, index) => (
            <React.Fragment key={`${index}-${item}`}>
              {index > 0 ? (
                <View style={styles.distinctionDivider}>
                  <View style={styles.distinctionLine} />
                  <ThemedText weight="semiBold" style={styles.distinctionDividerText}>KEEP DISTINCT</ThemedText>
                  <View style={styles.distinctionLine} />
                </View>
              ) : null}
              <View style={styles.comparisonItem}>
                <ThemedText selectable weight="semiBold" style={styles.comparisonLabel}>
                  {comparisonLabels[index]}
                </ThemedText>
                <ShareableSelectableText
                  text={item}
                  style={styles.comparisonText}
                  onShare={share}
                  showShareButton={false}
                />
              </View>
            </React.Fragment>
          ))}
        </View>
      ) : element.items.map((item, index) => (
        <React.Fragment key={`${index}-${item}`}>
          {index > 0 && element.kind === 'flow' ? <Ionicons accessibilityLabel="Then" name="arrow-down-outline" size={20} color="#B99562" style={styles.arrow} /> : null}
          <View style={styles.item}>
            <ShareableSelectableText
              text={item}
              style={styles.itemText}
              onShare={share}
              showShareButton={element.kind !== 'flow'}
            />
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 24, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(245,166,35,0.28)', backgroundColor: 'rgba(232,184,109,0.07)' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  label: { color: '#B99562', fontSize: 13, flexShrink: 1 },
  body: { color: 'rgba(255,255,255,0.9)', fontSize: 17, lineHeight: 26, marginTop: 12 },
  attribution: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 12 },
  share: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  item: { padding: 12, marginTop: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)' },
  itemText: { color: 'rgba(255,255,255,0.9)', fontSize: 16, lineHeight: 24 },
  arrow: { alignSelf: 'center', marginTop: 10 },
  comparisonStack: { marginTop: 10 },
  comparisonItem: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.055)',
  },
  comparisonLabel: {
    marginBottom: 7,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.8,
    color: '#B99562',
  },
  comparisonText: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 16,
    lineHeight: 24,
  },
  distinctionDivider: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  distinctionLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  distinctionDividerText: {
    fontSize: 8,
    lineHeight: 12,
    letterSpacing: 0.8,
    color: 'rgba(255,255,255,0.45)',
  },
});
