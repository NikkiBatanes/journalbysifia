import React, { useState, useEffect } from 'react';
import { View, Text, Alert } from 'react-native';
import ReflectionLogEditor from './ReflectionLogEditor';
import { useReflectionForm } from '../../hooks/useReflectionForm';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';

type ViewMode = 'free-form' | 'guided';

interface EnhancedReflectionLogEditorProps {
  onSave: (entry: {
    title: string;
    content: string;
    tags: string[];
    date: Date;
    type: ViewMode;
    prompt?: string;
    source?: 'freeform' | 'guided' | 'devotional' | 'playbook' | string;
  }) => void;
  onCancel: () => void;
  devotionalTitle?: string;
  totalDays?: number;
  dayNumber?: number;
  dayTitle?: string;
  questionNumber?: number;
  initialEntry?: {
    title?: string;
    content?: string;
    tags?: string[];
    type?: ViewMode;
    prompt?: string;
    source?: string;
  };
  initialMode?: ViewMode;
  initialPrompt?: string;
  dateString?: string;
  initialTitle?: string;
  lockTitle?: boolean;
  source?: 'freeform' | 'guided' | 'devotional' | 'playbook' | string;
  styles?: any;
}

export const EnhancedReflectionLogEditor: React.FC<EnhancedReflectionLogEditorProps> = ({
  onSave,
  onCancel,
  initialEntry = {},
  initialMode = 'free-form',
  dateString,
  ...otherProps
}) => {
  const [showValidationErrors, setShowValidationErrors] = useState(false);

  // Initialize form with validation
  const {
    values,
    errors,
    touched,
    isValid,
    handleChange,
    handleSubmit,
    resetForm,
  } = useReflectionForm({
    initialValues: {
      title: initialEntry.title || '',
      content: initialEntry.content || '',
      type: (initialEntry.type as 'free' | 'guided') || 'free',
      prompt: initialEntry.prompt || '',
      tags: initialEntry.tags || [],
    },
    onSubmit: async (formValues) => {
      try {
        await onSave({
          title: formValues.title,
          content: formValues.content,
          tags: formValues.tags,
          date: dateString ? new Date(dateString) : new Date(),
          type: formValues.type === 'free' ? 'free-form' : 'guided',
          prompt: formValues.prompt,
          source: otherProps.source,
        });
        resetForm();
      } catch (error) {
        console.error('Error saving reflection:', error);
        Alert.alert('Error', 'Failed to save reflection. Please try again.');
      }
    },
    validateOnChange: true,
    validateOnBlur: true,
  });

  // Handle save with validation
  const handleValidatedSave = () => {
    setShowValidationErrors(true);
    if (isValid) {
      handleSubmit();
    } else {
      // Show validation errors
      const errorMessages = Object.values(errors).filter(Boolean);
      if (errorMessages.length > 0) {
        Alert.alert('Validation Error', errorMessages[0]);
      }
    }
  };

  // Handle cancel
  const handleValidatedCancel = () => {
    resetForm();
    setShowValidationErrors(false);
    onCancel();
  };

  // Create enhanced entry object for the editor
  const enhancedEntry = {
    ...initialEntry,
    title: values.title,
    content: values.content,
    type: values.type === 'free' ? 'free-form' : 'guided',
    prompt: values.prompt,
    tags: values.tags,
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Validation Error Display */}
      {showValidationErrors && Object.keys(errors).length > 0 && (
        <View style={validationStyles.errorContainer}>
          {Object.entries(errors).map(([field, error]) => (
            error && touched[field as keyof typeof touched] ? (
              <Text key={field} style={validationStyles.errorText}>
                {error}
              </Text>
            ) : null
          ))}
        </View>
      )}

      {/* Original ReflectionLogEditor with enhanced props */}
      <ReflectionLogEditor
        {...otherProps}
        initialEntry={enhancedEntry}
        initialMode={initialMode}
        dateString={dateString}
        onSave={handleValidatedSave}
        onCancel={handleValidatedCancel}
      />
    </View>
  );
};

const validationStyles = {
  errorContainer: {
    backgroundColor: Colors.alertCoral,
    padding: 12,
    margin: 16,
    borderRadius: 8,
    marginBottom: 0,
  },
  errorText: {
    color: Colors.hopeWhite,
    fontSize: 14,
    fontFamily: Fonts.medium,
    textAlign: 'center' as const,
  },
};

export default EnhancedReflectionLogEditor;
