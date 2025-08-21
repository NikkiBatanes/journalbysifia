import React, { useState } from 'react';
import { View, Text, StyleSheet, TextStyle, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { BorderRadii } from '../theme/styles';
import { Typography } from '../theme/typography';
import { SimplifiedCardInsight } from './SimplifiedCardInsight';
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
  const expoundingAccess = useFeatureAccess({ feature: 'expounding' });
  const [showInsight, setShowInsight] = useState(false);
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
      <View style={styles.headerContainer}>
        <Text style={textStyle}>
          {text}
        </Text>
        <TouchableOpacity
          style={styles.expandIcon}
          onPress={() => {
            triggerLightHaptic();
            setShowInsight(!showInsight);
          }}
        >
          <Icon
            name={showInsight ? 'chevron-up' : 'information-outline'}
            size={20}
            color={color}
          />
        </TouchableOpacity>
      </View>

      {/* Simplified Card Insight */}
      {showInsight && (
        <SimplifiedCardInsight
          userId={user?.id || ''}
          cardType="affirmation"
          cardContent={text}
          playbookTitle={playbookTitle || ''}
          userOriginalInput={userInput}
          hasAccess={expoundingAccess.hasAccess}
        />
      )}
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
});

export default AffirmationCard;
