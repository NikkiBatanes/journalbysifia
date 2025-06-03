import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Fonts } from '../theme';

type DirectChallengeCardProps = {
  challenge: string;
  challengeCTA?: string;
};

export default function DirectChallengeCard({ challenge, challengeCTA }: DirectChallengeCardProps) {
  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <MaterialCommunityIcons 
          name="lightning-bolt" 
          size={24} 
          color={Colors.hopeWhite} 
          style={styles.icon}
        />
        <Text style={styles.heading}>Direct Challenge</Text>
      </View>
      <Text style={styles.text}>
        {challenge}
      </Text>
      {challengeCTA && (
        <Text style={styles.cta}>{challengeCTA}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.alertCoral,
    borderRadius: 24,
    padding: 24,
    width: '100%',
    alignSelf: 'stretch',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  icon: {
    marginRight: 12,
  },
  heading: {
    fontFamily: 'Inter-Black',
    fontSize: 20,
    color: Colors.hopeWhite,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  text: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 18,
    color: Colors.hopeWhite,
    lineHeight: 26,
    textAlign: 'left',
    paddingHorizontal: 8,
    fontWeight: '600',
    alignSelf: 'stretch',
    width: '100%',
    marginTop: 16,
  },
  cta: {
    fontFamily: 'Inter-Bold',
    fontSize: 17,
    color: Colors.faithGold,
    marginTop: 18,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
});
