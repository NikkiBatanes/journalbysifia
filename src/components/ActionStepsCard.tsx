import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Fonts } from '../theme';

type ActionStep = {
  id: string;
  text: string;
  completed: boolean;
};

type ActionStepsCardProps = {
  steps: ActionStep[];
};

export default function ActionStepsCard({ steps }: ActionStepsCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Action Steps</Text>
      {steps.map(step => (
        <View key={step.id} style={styles.stepRow}>
          <Text style={[styles.bullet, step.completed && styles.completed]}>•</Text>
          <Text style={[styles.stepText, step.completed && styles.completed]}>
            {step.text}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.hopeWhite,
    borderRadius: 14,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: Colors.anchorBlue,
    shadowColor: Colors.anchorBlue,
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  heading: {
    fontFamily: Fonts.bold,
    fontSize: 17,
    color: Colors.anchorBlue,
    marginBottom: 8,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  bullet: {
    fontSize: 15,
    marginRight: 8,
    color: Colors.faithGold,
  },
  stepText: {
    fontFamily: Fonts.semiBold,
    fontSize: 15,
    color: Colors.trustGrey,
  },
  completed: {
    color: Colors.growthGreen,
    textDecorationLine: 'line-through',
  },
});
