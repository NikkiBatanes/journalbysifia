import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
// Using inline colors since Colors constant may not be available
const Colors = {
  background: '#FFFFFF',
  text: '#000000',
  textSecondary: '#666666',
  textGray: '#999999',
  primary: '#1a3c6d',
  anchorBlue: '#1a3c6d',
  gray: '#999999',
  border: '#E1E1E1',
  inputBackground: '#F8F8F8',
};

interface NameCollectionModalProps {
  visible: boolean;
  onComplete: (firstName: string, lastName: string) => void;
  onSkip: () => void;
  userEmail: string;
}

const NameCollectionModal: React.FC<NameCollectionModalProps> = ({
  visible,
  onComplete,
  onSkip,
  userEmail,
}) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleComplete = () => {
    if (!firstName.trim()) {
      Alert.alert('Name Required', 'Please enter at least your first name to continue.');
      return;
    }

    setLoading(true);
    onComplete(firstName.trim(), lastName.trim());
  };

  const handleSkip = () => {
    Alert.alert(
      'Skip Name Setup?',
      'You can always add your name later in your profile settings.',
      [
        { text: 'Go Back', style: 'cancel' },
        { text: 'Skip', style: 'destructive', onPress: onSkip },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleSkip}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Complete Your Profile</Text>
            <Text style={styles.subtitle}>
              Help us personalize your experience by adding your name
            </Text>
            <Text style={styles.email}>{userEmail}</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>First Name *</Text>
              <TextInput
                style={styles.input}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Enter your first name"
                placeholderTextColor={Colors.textGray}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="next"
                autoFocus
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Last Name</Text>
              <TextInput
                style={styles.input}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Enter your last name"
                placeholderTextColor={Colors.textGray}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleComplete}
              />
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={handleComplete}
              disabled={loading}
            >
              <Text style={styles.primaryButtonText}>
                {loading ? 'Completing...' : 'Complete Setup'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={handleSkip}
              disabled={loading}
            >
              <Text style={styles.secondaryButtonText}>Skip for Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  email: {
    fontSize: 14,
    color: Colors.anchorBlue,
    fontWeight: '500',
  },
  form: {
    marginBottom: 40,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.text,
    backgroundColor: Colors.inputBackground,
  },
  actions: {
    gap: 12,
  },
  button: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: Colors.anchorBlue,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryButtonText: {
    color: Colors.textSecondary,
    fontSize: 16,
    fontWeight: '500',
  },
});

export default NameCollectionModal;
