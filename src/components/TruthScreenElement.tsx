import React, { useState } from 'react';
import { Alert, LayoutAnimation, Share, StyleSheet, TouchableOpacity, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ThemedText from './common/ThemedText';
import type { TruthScreenEnhancement } from '../../supabase/functions/_shared/truthScreenEnhancement';
import { triggerLightHaptic } from '../utils/haptics';
import ShareableSelectableText from './ShareableSelectableText';

interface TruthScreenElementProps {
  element: TruthScreenEnhancement;
  onShare?: (text: string) => void;
}

export default function TruthScreenElement({ element, onShare }: TruthScreenElementProps) {
  const [expanded, setExpanded] = useState(false);
  const share = async (textToShare: string) => {
    triggerLightHaptic();
    if (onShare) {
      onShare(textToShare);
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
          <ThemedText weight="semiBold" style={styles.label}>{expanded ? 'Show less' : 'Explore this thought'}</ThemedText>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color="#E8B86D" />
        </TouchableOpacity>
        {expanded ? <ShareableSelectableText text={element.text} style={styles.body} onShare={share} /> : null}
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <ThemedText weight="semiBold" style={styles.label}>
          {element.kind === 'takeaway' ? 'A thought to carry' : element.kind === 'flow' ? 'See the progression' : 'Notice the distinction'}
        </ThemedText>
      </View>
      {element.kind === 'takeaway' ? (
        <>
          <ShareableSelectableText text={element.text} weight="semiBold" style={styles.body} onShare={share} />
          <ThemedText style={styles.attribution}>siFia reflection</ThemedText>
        </>
      ) : element.items.map((item, index) => (
        <React.Fragment key={`${index}-${item}`}>
          {index > 0 && element.kind === 'flow' ? <Ionicons accessibilityLabel="Then" name="arrow-down-outline" size={20} color="#E8B86D" style={styles.arrow} /> : null}
          <View style={styles.item}><ShareableSelectableText text={item} style={styles.itemText} onShare={share} /></View>
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 24, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(245,166,35,0.28)', backgroundColor: 'rgba(232,184,109,0.07)' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  label: { color: '#E8B86D', fontSize: 13, flexShrink: 1 },
  body: { color: 'rgba(255,255,255,0.9)', fontSize: 17, lineHeight: 26, marginTop: 12 },
  attribution: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 12 },
  share: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  item: { padding: 12, marginTop: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)' },
  itemText: { color: 'rgba(255,255,255,0.9)', fontSize: 16, lineHeight: 24 },
  arrow: { alignSelf: 'center', marginTop: 10 },
});
