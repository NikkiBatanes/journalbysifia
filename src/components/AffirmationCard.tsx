import React from 'react';
import { View, Text, StyleSheet, TextStyle } from 'react-native';
import { Colors } from '../theme';

interface AffirmationCardProps {
  id: string;
  text: string;
  completed: boolean;
  color?: string;
}

const AffirmationCard: React.FC<AffirmationCardProps> = ({ 
  text, 
  color = 'white' 
}) => {
  const textStyle: TextStyle = {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    lineHeight: 24,
    color: color,
    textAlign: 'left' as const,
    textAlignVertical: 'center' as const,
    paddingHorizontal: 8,
    fontWeight: '600',
  };

  return (
    <View style={styles.card}>
      <Text style={textStyle}>
        {text}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    width: '100%',
    minHeight: 80, // Ensure minimum height for visibility
  },
});

export default AffirmationCard;
