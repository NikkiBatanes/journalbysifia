import React from 'react';
import {Platform, StyleSheet, Text, TouchableOpacity} from 'react-native';
import Animated, {FadeInUp} from 'react-native-reanimated';
import Ionicons from 'react-native-vector-icons/Ionicons';

import {getGratitudeVerse} from '../../data/getGratitudeVerse';
import {useAuth} from '../../context/IndustryStandardAuthContext';
import {
  getCachedScripturePassage,
  getScripturePassage,
  type ScriptureReaderResult,
} from '../../services/scriptureReaderService';
import ScriptureReaderModal from '../ScriptureReaderModal';
import ScriptureLoadingSkeleton from '../scripture/ScriptureLoadingSkeleton';
import ThemedText from '../common/ThemedText';
import {Colors} from '../../theme/colors';
import {triggerLightHaptic} from '../../utils/haptics';

interface GratitudeVerseProps {
  selectedDate: Date;
}

/** Shared verse presentation for every Gratitude walkthrough. */
const GratitudeVerse: React.FC<GratitudeVerseProps> = ({selectedDate}) => {
  const dailyVerse = React.useMemo(() => getGratitudeVerse(selectedDate), [selectedDate]);
  const {user} = useAuth();
  const preferredVersion = (user as any)?.user_metadata?.preferences?.content?.bibleVersion?.trim() || 'NASB';
  const [verse, setVerse] = React.useState<ScriptureReaderResult | null>(() =>
    getCachedScripturePassage(dailyVerse.reference, preferredVersion));
  const [failed, setFailed] = React.useState(false);
  const [retry, setRetry] = React.useState(0);
  const [modalVisible, setModalVisible] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    setFailed(false);
    setVerse(getCachedScripturePassage(dailyVerse.reference, preferredVersion));
    getScripturePassage(dailyVerse.reference, preferredVersion)
      .then(result => { if (active) {setVerse(result);} })
      .catch(() => { if (active) {setFailed(true);} });
    return () => { active = false; };
  }, [dailyVerse.reference, preferredVersion, retry]);

  // Only the user's preferred version renders; the bundled KJV text never does.
  if (failed && !verse) {
    return (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Retry loading Scripture"
        activeOpacity={0.7}
        onPress={() => setRetry(value => value + 1)}
        style={styles.offline}>
        <Ionicons name="cloud-offline-outline" size={16} color={Colors.sageMuted} />
        <ThemedText style={styles.offlineText}>Scripture unavailable · Tap to retry</ThemedText>
      </TouchableOpacity>
    );
  }

  if (!verse) {
    return (
      <ScriptureLoadingSkeleton
        variant="card"
        lines={3}
        style={styles.placeholder}
      />
    );
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
        accessibilityLabel={`Open ${verse.reference} in Scripture Reader`}
        style={styles.container}>
        <Animated.View
          entering={FadeInUp.springify().damping(18).stiffness(120)}
          style={styles.verseContent}>
          <Text
            style={styles.text}
            textBreakStrategy="simple"
            allowFontScaling
            maxFontSizeMultiplier={1.2}>
            {verse.text}
          </Text>
          <ThemedText weight="semiBold" style={styles.reference} maxFontSizeMultiplier={1.1}>
            {verse.reference.toUpperCase()}
          </ThemedText>
        </Animated.View>
      </TouchableOpacity>
      {modalVisible && (
        <ScriptureReaderModal
          visible={modalVisible}
          passages={[{reference: dailyVerse.reference}]}
          initialIndex={0}
          version={preferredVersion}
          onClose={() => setModalVisible(false)}
        />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  placeholder: {
    width: '100%',
    minHeight: 96,
    marginBottom: 20,
  },
  offline: {
    width: '100%',
    minHeight: 96,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 20,
  },
  offlineText: {
    flexShrink: 1,
    color: Colors.sageMuted,
    fontSize: 11,
  },
  container: {
    width: '100%',
    minHeight: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verseContent: {
    width: '100%',
    alignItems: 'center',
  },
  text: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontStyle: 'italic',
    fontSize: 17,
    lineHeight: 25,
    color: Colors.textGray,
    textAlign: 'center',
  },
  reference: {
    fontSize: 9,
    lineHeight: 13,
    letterSpacing: 1.2,
    color: Colors.sageMuted,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
});

export default GratitudeVerse;
