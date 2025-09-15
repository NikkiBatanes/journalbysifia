import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../theme/colors';

const MetricsExplainer: React.FC = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>How your score works</Text>
      <Text style={styles.item}>• Devotional generated: +8 pts</Text>
      <Text style={styles.item}>• Journal/Prayer entry: +5 pts</Text>
      <Text style={styles.item}>• Daily streak bonuses apply</Text>
      <Text style={styles.item}>• Levels increase at point thresholds</Text>
      <Text style={styles.footer}>Keep up your daily streak to level up faster.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 20,
    marginTop: 4,
    borderColor: Colors.cardBorder,
    borderWidth: 1,
    shadowColor: Colors.black,
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.darkerGray,
    marginBottom: 8,
  },
  item: {
    fontSize: 13,
    color: Colors.darkGray,
    marginBottom: 4,
  },
  footer: {
    fontSize: 12,
    color: Colors.textGray,
    marginTop: 8,
  },
});

export default MetricsExplainer;
