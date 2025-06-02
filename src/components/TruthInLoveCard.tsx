import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Fonts } from '../theme';

type TruthInLoveCardProps = {
  truth: string;
  summary: string;
  username?: string;
  expanded?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function TruthInLoveCard({ truth, summary, username = 'Nikki', expanded = false, style }: TruthInLoveCardProps) {
  return (
    <View style={style}>
      <View style={styles.headingContainer}>
        <Ionicons name="heart" size={24} color="#FF6B6B" style={styles.heartIcon} />
        <Text style={styles.heading}>Truth in Love</Text>
      </View>
      
      <View style={styles.contentContainer}>
        <Text style={styles.content}>
          <Text style={styles.username}>{username}, </Text>
          <Text style={styles.summary}>{summary}</Text>
        </Text>
        <Text 
          style={styles.truncatedTruth} 
          numberOfLines={5} 
          ellipsizeMode="tail"
        >
          {truth}
        </Text>
      </View>
      
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
  headingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8, // Reduced from 20 to 8
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
  contentContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingBottom: 20, // Reduced padding to 20
    maxHeight: '80%', // Limit height to prevent overflow
  },
  content: {
    fontFamily: 'Inter-Regular',
    fontSize: 28,
    lineHeight: 38,
    color: Colors.hopeWhite,
    marginBottom: 4, // Reduced from 12 to 4
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
    lineHeight: 24,
    color: Colors.hopeWhite,
    opacity: 0.8,
    marginTop: 4, // Further reduced from 8 to 4
  },
  truncatedTruth: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    lineHeight: 24,
    color: Colors.hopeWhite,
    opacity: 0.8,
    marginTop: 2,
    flexShrink: 1, // Allow text to shrink if needed
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 8,
    minHeight: 32, // Ensure consistent height for the footer
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
    right: 8,
    bottom: 8,
  },
  expandIcon: {
    opacity: 0.9,
  },
});
