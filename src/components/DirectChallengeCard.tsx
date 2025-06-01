import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Fonts } from '../theme';

type DirectChallengeCardProps = {
  challenge: string;
};

export default function DirectChallengeCard({ challenge }: DirectChallengeCardProps) {
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: Colors.alertCoral,
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
    lineHeight: 28,
    color: 'rgba(255, 255, 255, 0.95)',
    textAlign: 'left',
    paddingHorizontal: 8,
    fontWeight: '600',
    marginTop: 16,
  },
});
