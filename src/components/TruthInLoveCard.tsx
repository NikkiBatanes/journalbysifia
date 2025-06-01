import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors, Fonts } from '../theme';

type TruthInLoveCardProps = {
  truth: string;
  summary: string;
  username?: string;
  expanded?: boolean;
};

export default function TruthInLoveCard({ truth, summary, username = 'Nikki', expanded = false }: TruthInLoveCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.iconContainer}>
        <Ionicons name="warning" size={24} color="#FF6B6B" />
      </View>
      <Text style={styles.heading}>Truth in Love</Text>
      
      <Text style={styles.content}>
        <Text style={styles.username}>{username}, </Text>
        <Text>{summary}</Text>
      </Text>
      
      {expanded && (
        <Text style={styles.truth}>{truth}</Text>
      )}
      
      {!expanded && (
        <View style={styles.swipeContainer}>
          <Text style={styles.swipeText}>Swipe up to unlock next</Text>
          <Ionicons name="expand" size={20} color="#FFD700" style={styles.expandIcon} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.anchorBlue,
    borderRadius: 28,
    padding: 24,
    flex: 1,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  iconContainer: {
    marginBottom: 12,
  },
  heading: {
    fontFamily: Fonts.bold,
    fontSize: 24,
    color: Colors.hopeWhite,
    marginBottom: 20,
  },
  content: {
    fontFamily: Fonts.regular,
    fontSize: 28,
    lineHeight: 38,
    color: Colors.hopeWhite,
    marginBottom: 20,
  },
  username: {
    fontFamily: Fonts.bold,
  },
  truth: {
    fontFamily: Fonts.regular,
    fontSize: 16,
    color: Colors.hopeWhite,
    opacity: 0.8,
    marginTop: 16,
  },
  swipeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 40,
  },
  swipeText: {
    fontFamily: Fonts.regular,
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  expandIcon: {
    transform: [{ rotate: '45deg' }],
  },
});
