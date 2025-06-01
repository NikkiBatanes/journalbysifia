import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  Animated,
  SafeAreaView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';
import { Playbook } from '../interfaces/playbook';

const exampleStruggles = [
  'I struggle with being consistent in my daily devotions',
  'I feel like my prayers aren\'t being answered',
  'I\'m having difficulty forgiving someone who hurt me',
  'I\'m worried about my future and can\'t trust God\'s plan',
  'I feel disconnected from my church community',
];

type UserInputScreenNavigationProp = StackNavigationProp<RootStackParamList, 'MainTabs'>;

const UserInputScreen: React.FC = () => {
  const navigation = useNavigation<UserInputScreenNavigationProp>();
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const buttonScale = useRef(new Animated.Value(1)).current;
  const inputBorderWidth = useRef(new Animated.Value(1)).current;

  const animateButton = () => {
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleInputFocus = () => {
    Animated.timing(inputBorderWidth, {
      toValue: 2,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const handleInputBlur = () => {
    Animated.timing(inputBorderWidth, {
      toValue: 1,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const handleExampleSelect = (example: string) => {
    setUserInput(example);
  };

  const getUserFirstName = (text: string) => {
    const nameMatch = text.match(/\b(?:I|my name is|I'm|I am)\s+([A-Za-z]+)/i);
    return nameMatch ? nameMatch[1] : 'Friend';
  };

  const handleGeneratePlaybook = async () => {
    animateButton();
    if (!userInput.trim()) {
      Alert.alert('Input Required', 'Please share what you\'re struggling with.');
      return;
    }
    
    setIsLoading(true);
    try {
      // TODO: Replace with actual API call to generate playbook
      const firstName = getUserFirstName(userInput);
      const mockPlaybook: Playbook = {
        id: Date.now().toString(),
        title: `Playbook for ${firstName}`,
        truthInLove: 'God cares about your struggles and is with you in this journey.',
        truthSummary: 'God is faithful and will help you through this challenge.',
        actionSteps: [
          { id: '1', text: 'Spend 5 minutes in prayer today', completed: false },
          { id: '2', text: 'Read a chapter from the book of Psalms', completed: false },
          { id: '3', text: 'Reach out to a friend for support', completed: false },
        ],
        affirmation: 'I am loved by God and He is working in my life.',
        bibleVerse: {
          text: 'Cast all your anxiety on him because he cares for you.',
          reference: '1 Peter 5:7',
        },
        directChallenge: 'Challenge yourself to trust God with this situation today.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userInput,
      };
      
      // Navigate to PlaybookDetail with the generated playbook
      navigation.navigate('PlaybookDetail', { playbook: mockPlaybook });
    } catch (error) {
      Alert.alert('Error', 'Failed to generate playbook. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.title}>AnchoredAI</Text>
            <Text style={styles.subtitle}>Share what you're struggling with</Text>
          </View>

          <View style={styles.inputContainer}>
            <Animated.View
              style={[
                styles.inputWrapper,
                { borderWidth: inputBorderWidth },
              ]}
            >
              <TextInput
                style={styles.input}
                placeholder="I'm struggling with..."
                placeholderTextColor="#999"
                value={userInput}
                onChangeText={setUserInput}
                multiline
                textAlignVertical="top"
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
              />
            </Animated.View>

            <Text style={styles.exampleTitle}>Examples:</Text>
            <View style={styles.examplesContainer}>
              {exampleStruggles.map((example, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.exampleButton}
                  onPress={() => handleExampleSelect(example)}
                >
                  <Text style={styles.exampleText}>{example}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
            <TouchableOpacity
              style={[styles.generateButton, isLoading && styles.disabledButton]}
              onPress={handleGeneratePlaybook}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.generateButtonText}>Generate Playbook</Text>
              )}
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 40,
  },
  header: {
    marginBottom: 30,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 30,
  },
  inputWrapper: {
    borderColor: '#007AFF',
    borderRadius: 12,
    backgroundColor: '#F5F7FA',
    marginBottom: 20,
  },
  input: {
    minHeight: 120,
    padding: 16,
    fontSize: 16,
    color: '#333',
    textAlignVertical: 'top',
  },
  exampleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  examplesContainer: {
    marginBottom: 20,
  },
  exampleButton: {
    backgroundColor: '#F0F4F8',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  exampleText: {
    color: '#333',
    fontSize: 14,
  },
  generateButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 'auto',
    marginBottom: 40,
  },
  disabledButton: {
    opacity: 0.7,
  },
  generateButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default UserInputScreen;
