import React, { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import ScriptureReaderModal from '../ScriptureReaderModal';
import ThemedText from '../common/ThemedText';
import { Colors } from '../../theme/colors';

import { getScripturePassage } from '../../services/scriptureReaderService';
import { getDashboardHeaderScripture } from '../../data/dashboardHeaderScriptures';

interface DashboardHeaderScriptureProps {
  date?: Date;
  bibleVersion: string;
  previewOffset?: number;
  centered?: boolean;
}

const DashboardHeaderScripture: React.FC<DashboardHeaderScriptureProps> = ({ date, bibleVersion, previewOffset = 0, centered = false }) => {
  const now = date ?? new Date();
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);

  const isEvening = now.getHours() >= 17;
  const scripture = useMemo(
    () => getDashboardHeaderScripture(now, isEvening, previewOffset),
    [now, isEvening, previewOffset],
  );

  useEffect(() => {
    let mounted = true;
    setText(null);
    setError(false);
    getScripturePassage(scripture.passageReference, bibleVersion)
      .then(result => {
        if (mounted) { setText(result.text); }
      })
      .catch(() => {
        if (mounted) { setError(true); }
      });
    return () => { mounted = false; };
  }, [scripture.passageReference, bibleVersion, retry]);

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
        onPress={() => { setModalVisible(true); }}
        accessibilityRole="button"
        accessibilityLabel={`Open ${scripture.displayReference} in Scripture Reader`}
        style={[styles.container, centered && styles.containerCentered]}
      >
        <View style={[styles.container, centered && styles.containerCentered]}>
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
        </View>
      </TouchableOpacity>
      <ScriptureReaderModal
        visible={modalVisible}
        passages={[{ reference: scripture.passageReference }]}
        initialIndex={0}
        version={bibleVersion}
        onClose={() => { setModalVisible(false); }}
      />
    </>
  );
};

const styles = StyleSheet.create({
  placeholder: {
    width: '100%',
    minHeight: 50,
  },
  offline: {
    width: '100%',
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    marginTop: 12,
  },
  offlineText: {
    color: Colors.sageMuted,
    fontSize: 11,
  },
  container: {
    width: '100%',
    minHeight: 50,
    alignItems: 'flex-end',
    marginTop: 12,
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
