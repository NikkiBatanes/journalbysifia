import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../theme';

import { TouchableOpacity } from 'react-native';

type AffirmationCardProps = {
  id: string;
  text: string;
  completed: boolean;
};

export default function AffirmationCard({ text }: AffirmationCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.text}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    width: '100%',
    minHeight: 80, // Ensure minimum height for visibility
  },
  text: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    lineHeight: 24,
    color: 'white',
    textAlign: 'left',
    textAlignVertical: 'center',
    paddingHorizontal: 8,
    fontWeight: '600',
  },
});
