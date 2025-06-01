import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
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
      <View style={styles.headingContainer}>
        <Ionicons name="heart" size={24} color="#FF6B6B" style={styles.heartIcon} />
        <Text style={styles.heading}>Truth in Love</Text>
      </View>
      
      <Text style={styles.content}>
        <Text style={styles.username}>{username}, </Text>
        <Text style={styles.summary}>{summary}</Text>
      </Text>
      
      {expanded && (
        <Text style={styles.truth}>{truth}</Text>
      )}
      
      {!expanded && (
        <View style={styles.footerContainer}>
          <View style={styles.swipeHint}>
            <Text style={styles.swipeText}>Swipe up to continue</Text>
            <Ionicons name="arrow-up" size={16} color="rgba(255, 255, 255, 0.6)" style={styles.arrowIcon} />
          </View>
          <View style={styles.expandHint}>
            <MaterialCommunityIcons name="arrow-expand" size={24} color={Colors.faithGold} style={styles.expandIcon} />
          </View>
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
  headingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  heartIcon: {
    marginRight: 8,
  },
  heading: {
    fontFamily: 'Inter-ExtraBold',
    fontSize: 20,
    color: Colors.hopeWhite,
    letterSpacing: 0.5,
    textTransform: 'none',
    fontWeight: '800',
  },
  content: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 28,
    lineHeight: 38,
    color: Colors.hopeWhite,
    marginBottom: 20,
  },
  username: {
    fontFamily: 'Inter-Bold',
    fontWeight: '800',
  },
  summary: {
    fontFamily: 'Inter-Bold',
    fontWeight: '800',
  },
  truth: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: Colors.hopeWhite,
    opacity: 0.8,
    marginTop: 16,
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 'auto',
  },
  swipeHint: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  swipeText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    marginLeft: 4,
  },
  arrowIcon: {
    marginLeft: 4,
  },
  expandHint: {
    position: 'absolute',
    right: 8,  // Moved 8px closer to the corner
    bottom: 0,  // Positioned at the very bottom
  },
  expandIcon: {
    opacity: 0.9,
  },
});
