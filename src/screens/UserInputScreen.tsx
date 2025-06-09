import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  StatusBar,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';
import { Playbook } from '../interfaces/playbook';
import { useUser } from '../context/UserContext';
import { generatePlaybook, savePlaybook } from '../services/supabaseApi';
import { Colors } from '../theme/colors';
import Ionicons from 'react-native-vector-icons/Ionicons';

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
  
  // Set status bar style
  useEffect(() => {
    // For Android
    StatusBar.setBackgroundColor(Colors.anchorBlue);
    StatusBar.setBarStyle('light-content');
    
    return () => {
      // Reset status bar style when component unmounts if needed
      StatusBar.setBackgroundColor('transparent');
      StatusBar.setBarStyle('dark-content');
    };
  }, []);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [placeholderText, setPlaceholderText] = useState('');
  const placeholderIndex = useRef(0);
  const charIndex = useRef(0);
  const isDeleting = useRef(false);
  const placeholderTexts = [
    'help with a tough decision...',
    'guide you through a struggle...',
    'provide wisdom for your next step...',
    'support you in a life transition...',
    'help you navigate a relationship challenge...',
    'offer encouragement in difficult times...',
    'help you discern your purpose...',
    'guide your spiritual growth...',
    'help you find peace in uncertainty...',
    'provide insight for a big decision...',
  ];
  
  // Store the timeout ID to clear it on unmount
  const timeoutRef = useRef<NodeJS.Timeout>();

  const animatePlaceholder = useCallback(() => {
    const currentText = placeholderTexts[placeholderIndex.current];
    
    if (isDeleting.current) {
      // Delete characters
      setPlaceholderText(prev => {
        const newText = prev.slice(0, -1);
        if (newText.length === 0) {
          isDeleting.current = false;
          placeholderIndex.current = (placeholderIndex.current + 1) % placeholderTexts.length;
          charIndex.current = 0;
          // Pause before starting next phrase
          timeoutRef.current = setTimeout(animatePlaceholder, 1000);
          return newText;
        }
        // Schedule next deletion
        timeoutRef.current = setTimeout(animatePlaceholder, 30);
        return newText;
      });
    } else {
      // Add characters
      const newText = currentText.slice(0, charIndex.current + 1);
      setPlaceholderText(newText);
      
      if (charIndex.current === currentText.length - 1) {
        isDeleting.current = true;
        // Pause at full text before starting to delete
        timeoutRef.current = setTimeout(animatePlaceholder, 2000);
      } else {
        charIndex.current++;
        // Type at a slower pace
        timeoutRef.current = setTimeout(animatePlaceholder, 100);
      }
    }
  }, [placeholderTexts]);
  
  useEffect(() => {
    // Initial delay before starting animation
    timeoutRef.current = setTimeout(animatePlaceholder, 1000);
    
    // Cleanup function to clear any pending timeouts
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [animatePlaceholder]);
  const [error, setError] = useState(null);
  const buttonScale = useRef(new Animated.Value(1)).current;
  const inputBorderWidth = useRef(new Animated.Value(1)).current;
  const { name: userName, id: userId } = useUser();

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

  // Use the real generatePlaybook from the API service
  // Remove the local mock implementation.


  const handleGeneratePlaybook = async () => {
    animateButton();
    if (!userInput.trim()) {
      Alert.alert('Input Required', 'Please share what you\'re struggling with.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const aiResponse = await generatePlaybook(userInput, userName);
      aiResponse.createdAt = new Date().toISOString();
      if (userId) {
        await savePlaybook(aiResponse, userId);
      }
      navigation.navigate('PlaybookDetail', { playbook: aiResponse });
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

          {/* Redesigned Ask Input Area */}
          <View style={styles.askContainer}>
            <View style={styles.askBox}>
              <TextInput
                style={styles.askInput}
                placeholder={`Ask Anchored to ${placeholderText}`}
                placeholderTextColor={Colors.trustGrey}
                value={userInput}
                onChangeText={setUserInput}
                multiline
                maxLength={500}
                textAlignVertical="center"
              />
              <TouchableOpacity 
                style={styles.askSendButton} 
                onPress={handleGeneratePlaybook} 
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color={Colors.hopeWhite} />
                ) : (
                  <Ionicons name="arrow-up-circle" size={34} color={Colors.hopeWhite} />
                )}
              </TouchableOpacity>
            </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 40,
    paddingHorizontal: -20,
  },
  header: {
    marginBottom: 30,
    alignItems: 'center',
  },
  title: {
    fontSize: 34,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginBottom: 24,
  },
  askContainer: {
    paddingHorizontal: 0,
    marginBottom: 24,
    width: '100%',
  },
  askBox: {
    borderRadius: 28,
    backgroundColor: Colors.inputBackground,
    borderWidth: 1.5,
    borderColor: Colors.inputBorder,
    padding: 16,
    paddingBottom: 24,
    width: '100%',
    minHeight: 150,
    marginVertical: 8,
  },
  askInput: {
    color: Colors.hopeWhite,
    fontSize: 18,
    textAlignVertical: 'top',
    paddingRight: 40, // Space for send button
    lineHeight: 24,
    backgroundColor: 'transparent',
    minHeight: 120,
    maxHeight: 200, // Maximum height before scrolling starts
    width: '100%',
    overflow: 'scroll',
    textAlign: 'left',
  },
  askSendButton: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    zIndex: 10,
    borderRadius: 20,
    padding: 0,
  },
});

export default UserInputScreen;
