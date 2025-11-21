import React from 'react';
import { View, StyleSheet, TextStyle, Platform } from 'react-native';
import { BorderRadii } from '../theme/styles';
import ThemedText from './common/ThemedText';
import ThemedTextInput from './common/ThemedTextInput';

interface AffirmationCardProps {
  id: string;
  text: string;
  completed: boolean;
  color?: string;
  containerStyle?: any;
  enableSelection?: boolean;
}

const AffirmationCard: React.FC<AffirmationCardProps> = ({
  text,
  color = 'white',
  containerStyle = {},
  enableSelection = false,
}) => {
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
      {enableSelection && Platform.OS === 'ios' ? (
        <ThemedTextInput
          weight="regular"
          value={text}
          editable={false}
          multiline={true}
          scrollEnabled={false}
          style={textStyle}
        />
      ) : (
        <ThemedText weight="regular" style={textStyle} selectable={enableSelection}>
          {text}
        </ThemedText>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: BorderRadii.cardLarge,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 20,
    justifyContent: 'center',
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
