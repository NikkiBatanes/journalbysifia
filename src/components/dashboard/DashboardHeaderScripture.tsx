import React, { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import Ionicons from 'react-native-vector-icons/Ionicons';

import ScriptureReaderModal from '../ScriptureReaderModal';
import ShareComposer from '../TruthToCarryShareComposer';
import ThemedText from '../common/ThemedText';
import { Colors } from '../../theme/colors';

import { getCachedScripturePassage, getScripturePassage } from '../../services/scriptureReaderService';
import { getDashboardHeaderScripture } from '../../data/dashboardHeaderScriptures';
import {prefetchDashboardScriptures} from '../../services/dashboardScripturePrefetchService';
import {triggerLightHaptic} from '../../utils/haptics';

interface DashboardHeaderScriptureProps {
  date?: Date;
  bibleVersion: string;
  previewOffset?: number;
  centered?: boolean;
}

const DashboardHeaderScripture: React.FC<DashboardHeaderScriptureProps> = ({ date, bibleVersion, previewOffset = 0, centered = false }) => {
  const now = useMemo(() => date ?? new Date(), [date]);
  const [loaded, setLoaded] = useState<{ key: string; text: string } | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [shareComposerOpen, setShareComposerOpen] = useState(false);
  const [shareComposerText, setShareComposerText] = useState('');

  const isEvening = now.getHours() >= 17;
  const scripture = useMemo(
    () => getDashboardHeaderScripture(now, isEvening, previewOffset),
    [now, isEvening, previewOffset],
  );
  const requestKey = `${bibleVersion}:${scripture.passageReference}`;
  const text = getCachedScripturePassage(scripture.passageReference, bibleVersion)?.text
    ?? (loaded?.key === requestKey ? loaded.text : null);
  const error = failedKey === requestKey && !text;

  useEffect(() => {
    let mounted = true;
    setFailedKey(null);
    if (getCachedScripturePassage(scripture.passageReference, bibleVersion)) { return; }
    getScripturePassage(scripture.passageReference, bibleVersion)
      .then(result => {
        if (mounted) { setLoaded({ key: requestKey, text: result.text }); }
      })
      .catch(() => {
        if (mounted) { setFailedKey(requestKey); }
      });
    return () => { mounted = false; };
  }, [scripture.passageReference, bibleVersion, requestKey, retry]);

  useEffect(() => {
    if (!text) { return; }
    // Warm the next daily passages only after the visible verse is ready.
    const timer = setTimeout(() => {
      prefetchDashboardScriptures(bibleVersion, now).catch(() => {});
    }, 1000);
    return () => clearTimeout(timer);
  }, [text, now, bibleVersion]);

  if (error) {
    return <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel="Retry loading dashboard Scripture"
      activeOpacity={0.7}
      onPress={() => setRetry(value => value + 1)}
      style={[styles.offline, centered && styles.containerCentered]}
    >
      <Ionicons name="cloud-offline-outline" size={16} color={Colors.sageMuted} />
      <ThemedText style={styles.offlineText}>Scripture unavailable · Tap to retry</ThemedText>
    </TouchableOpacity>;
  }

  if (!text) {
    return <View style={styles.placeholder} />;
  }

  return (
    <>
      <TouchableOpacity
        activeOpacity={1}
        onPress={() => {
          triggerLightHaptic();
          setModalVisible(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={`Open ${scripture.displayReference} in Scripture Reader`}
        style={[styles.container, centered && styles.containerCentered]}
      >
        <Animated.View
          entering={FadeInUp.springify().damping(18).stiffness(120)}
          style={[styles.verseContent, centered && styles.containerCentered]}
        >
          <Text
            style={[styles.verse, centered && styles.verseCentered]}
            textBreakStrategy="simple"
            allowFontScaling
            maxFontSizeMultiplier={1.2}
          >
            {text}
          </Text>
          <ThemedText weight="semiBold" style={[styles.reference, centered && styles.referenceCentered]} maxFontSizeMultiplier={1.1}>
            {scripture.displayReference.toUpperCase()}
          </ThemedText>
        </Animated.View>
      </TouchableOpacity>
      {modalVisible && <ScriptureReaderModal
        visible={modalVisible}
        passages={[{ reference: scripture.passageReference }]}
        initialIndex={0}
        version={bibleVersion}
        onClose={() => { setModalVisible(false); }}
        onShareScripture={shareText => {
          setShareComposerText(shareText);
          setShareComposerOpen(true);
        }}
      />}
      <ShareComposer
        visible={shareComposerOpen}
        text={shareComposerText}
        onClose={() => setShareComposerOpen(false)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  placeholder: {
    width: '100%',
    height: 112,
    marginTop: 12,
  },
  offline: {
    width: '100%',
    minHeight: 112,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    marginTop: 12,
  },
  offlineText: {
    flexShrink: 1,
    color: Colors.sageMuted,
    fontSize: 11,
  },
  container: {
    width: '100%',
    minHeight: 112,
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginTop: 12,
  },
  verseContent: {
    width: '100%',
    alignItems: 'flex-end',
  },
  verse: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    color: Colors.textGray,
    fontSize: 17,
    lineHeight: 25,
    textAlign: 'right',
    fontStyle: 'italic',
  },
  reference: {
    color: Colors.sageMuted,
    fontSize: 9,
    lineHeight: 13,
    letterSpacing: 1.2,
    textAlign: 'right',
    marginTop: 8,
  },
  containerCentered: {
    alignItems: 'center',
  },
  verseCentered: {
    textAlign: 'center',
  },
  referenceCentered: {
    textAlign: 'center',
  },
});

export default DashboardHeaderScripture;
