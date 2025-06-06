import React from 'react';
import { View, Text, StyleSheet, TextStyle } from 'react-native';
import { BorderRadii } from '../theme/styles';
import { Colors } from '../theme';
import { Typography } from '../theme/typography';

interface AffirmationCardProps {
  id: string;
  text: string;
  completed: boolean;
  color?: string;
  containerStyle?: any;
}

const AffirmationCard: React.FC<AffirmationCardProps> = ({
  text,
  color = 'white',
  containerStyle = {},
}) => {
  const textStyle: TextStyle = {
    ...Typography.interSemiBold,
    fontSize: 16,
    lineHeight: 24,
    color: color,
    textAlign: 'left',
    textAlignVertical: 'center',
    paddingHorizontal: 8,
  };

  return (
    <View style={[styles.card, containerStyle]}>
      <Text style={textStyle}>
        {text}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: BorderRadii.cardLarge,
    padding: 16,
    marginBottom: 12,
    width: '100%',
    minHeight: 80, // Ensure minimum height for visibility
  },
});

export default AffirmationCard;
