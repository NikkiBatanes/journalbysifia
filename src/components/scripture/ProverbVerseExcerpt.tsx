import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import ThemedText from '../common/ThemedText';
import { getScripturePassage } from '../../services/scriptureReaderService';
import { Colors } from '../../theme/colors';

type Props = {
  reference: string;
  version?: string;
  numberOfLines?: number;
};

const passageText = (passage: Awaited<ReturnType<typeof getScripturePassage>>): string =>
  passage.verses?.length
    ? passage.verses.map(verse => verse.lines.join('\n')).join('\n')
    : passage.text.trim();

/** A compact, read-only Scripture excerpt shared by Moments and Review cards. */
const ProverbVerseExcerpt: React.FC<Props> = ({reference, version = 'NASB', numberOfLines}) => {
  const [verse, setVerse] = React.useState('');

  React.useEffect(() => {
    let active = true;
    setVerse('');
    getScripturePassage(reference.replace(/–/g, '-'), version)
      .then(result => {
        if (active) {setVerse(passageText(result));}
      })
      .catch(() => {
        // Keep the saved reference visible if this passage is not cached and
        // the device is offline. It will load automatically on the next view.
      });
    return () => {active = false;};
  }, [reference, version]);

  if (!reference.trim()) {return null;}

  return (
    <View style={styles.container}>
      {!!verse && <Text style={styles.verse} numberOfLines={numberOfLines}>{verse}</Text>}
      <ThemedText style={styles.reference}>{reference}</ThemedText>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {width: '100%', marginTop: 7},
  verse: {
    color: Colors.text,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 22,
    textAlign: 'left',
  },
  reference: {color: Colors.textGray, fontSize: 11, lineHeight: 16, marginTop: 5, textAlign: 'left'},
});

export default ProverbVerseExcerpt;
