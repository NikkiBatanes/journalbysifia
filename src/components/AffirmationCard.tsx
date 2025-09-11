import React, { useState } from 'react';
import { View, Text, StyleSheet, TextStyle, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { BorderRadii } from '../theme/styles';
import { Typography } from '../theme/typography';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { useFeatureAccess } from '../hooks/useFeatureAccess';
import { triggerLightHaptic } from '../utils/haptics';

interface AffirmationCardProps {
  id: string;
  text: string;
  completed: boolean;
  color?: string;
  containerStyle?: any;
  playbookTitle?: string;
  userInput?: string;
}

const AffirmationCard: React.FC<AffirmationCardProps> = ({
  text,
  color = 'white',
  containerStyle = {},
  playbookTitle,
  userInput,
}) => {
  const { user } = useAuth();
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
      <Text style={textStyle}>{text}</Text>
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
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  expandIcon: {
    padding: 4,
    marginLeft: 8,
  },
  insightPlaceholder: {
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    marginTop: 8,
  },
  insightPlaceholderText: {
    ...Typography.interRegular,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
  },
});

export default AffirmationCard;
