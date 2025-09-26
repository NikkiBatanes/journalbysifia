import React from 'react';
import { View, StyleSheet, TextStyle } from 'react-native';
import { BorderRadii } from '../theme/styles';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { triggerLightHaptic } from '../utils/haptics';
import ThemedText from './common/ThemedText';

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
    // Typography handled by ThemedText weight="semiBold"
    fontSize: 16,
    lineHeight: 24,
    color: color,
    textAlign: 'left',
    textAlignVertical: 'center',
    paddingHorizontal: 8,
  };

  return (
    <View style={[styles.card, containerStyle]}>
      <ThemedText weight="semiBold" style={textStyle}>{text}</ThemedText>
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
    // Typography handled by ThemedText weight="regular"
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
  },
});

export default AffirmationCard;
