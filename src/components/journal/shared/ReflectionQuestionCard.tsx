import React from 'react';
import {TouchableOpacity, View} from 'react-native';
import {Pencil} from 'lucide-react-native';
import ThemedText from '../../common/ThemedText';
import {Colors} from '../../../theme/colors';

export const ReflectionQuestionCard = ({
  question,
  onReflect,
  styles,
  lock,
}: {
  question: string;
  onReflect: () => void;
  styles: any;
  lock?: React.ReactNode;
}) => (
  <View style={styles.promptCard}>
    {lock ? <View style={styles.lockIconContainer}>{lock}</View> : null}
    <View style={styles.promptTextContainer}>
      <ThemedText style={styles.promptCardText}>{question}</ThemedText>
    </View>
    <TouchableOpacity
      style={styles.reflectLabel}
      onPress={onReflect}
      accessibilityRole="button"
      accessibilityLabel="Reflect">
      <Pencil size={16} color={Colors.hopeWhite} style={styles.buttonIcon} />
      <ThemedText weight="medium" style={styles.reflectLabelText}>
        Reflect
      </ThemedText>
    </TouchableOpacity>
  </View>
);
