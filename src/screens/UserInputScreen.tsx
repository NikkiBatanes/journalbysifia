import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';

import { useUser } from '../context/UserContext';
import { generatePlaybook, savePlaybook } from '../services/supabaseApi';
import { Colors } from '../theme/colors';
import Ionicons from 'react-native-vector-icons/Ionicons';

type UserInputScreenNavigationProp = StackNavigationProp<RootStackParamList, 'MainTabs'> & {
  navigate: (screen: 'GeneratingPlaybook', params: { userInput: string; userName: string }) => void;
  reset: (state: any) => void; // Add reset method to navigation prop
};

const UserInputScreen: React.FC = () => {
  const navigation = useNavigation<UserInputScreenNavigationProp>();
  const inputRef = useRef<TextInput | null>(null);

  // Set status bar style
  useEffect(() => {
    // For Android
    if (Platform.OS === 'android') {
      StatusBar.setBackgroundColor(Colors.anchorBlue);
    }
    StatusBar.setBarStyle('light-content');

    return () => {
      // Reset status bar style when component unmounts if needed
      if (Platform.OS === 'android') {
        StatusBar.setBackgroundColor('transparent');
      }
      StatusBar.setBarStyle('dark-content');
    };
  }, []);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [placeholderText, setPlaceholderText] = useState('');
  const placeholderIndex = useRef(0);
  // Animate placeholder text
  useEffect(() => {
    const placeholderTexts = [
      'help you navigate a relationship challenge...',
      'offer encouragement in difficult times...',
      'help you discern your purpose...',
      'guide your spiritual growth...',
      'help you find peace in uncertainty...',
      'provide insight for a big decision...',
    ];

    const currentText = placeholderTexts[placeholderIndex.current];
    setPlaceholderText(currentText);

    const interval = setInterval(() => {
      placeholderIndex.current = (placeholderIndex.current + 1) % placeholderTexts.length;
      setPlaceholderText(placeholderTexts[placeholderIndex.current]);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const { name: userName, id: userId } = useUser();

  const buttonScale = useRef(new Animated.Value(1)).current;
  const inputBorderWidth = useRef(new Animated.Value(1)).current;

  const animateButton = () => {
    // Simple button press animation
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

  // Use the real generatePlaybook from the API service
  // Remove the local mock implementation.


  const handleGeneratePlaybook = async () => {
    animateButton();
    if (!userInput.trim()) {
      // Show error animation
      Animated.sequence([
        Animated.timing(inputBorderWidth, {
          toValue: 2,
          duration: 100,
          useNativeDriver: false,
        }),
        Animated.timing(inputBorderWidth, {
          toValue: 1,
          duration: 100,
          useNativeDriver: false,
        }),
      ]).start();
      Alert.alert('Input Required', 'Please share what you\'re struggling with.');
      return;
    }

    // Navigate to GeneratingPlaybookScreen first
    navigation.navigate('GeneratingPlaybook', {
      userInput,
      userName: userName || 'Friend',
    });

    setIsLoading(true);
    try {
      const aiResponse = await generatePlaybook(userInput, userName);
      aiResponse.createdAt = new Date().toISOString();
      if (userId) {
        await savePlaybook(aiResponse, userId);
      }

      // Navigate to PlaybookDetail with the generated playbook
      navigation.reset({
        index: 0,
        routes: [
          { name: 'MainTabs', state: {
            routes: [
              { name: 'Home' },
              { name: 'PlaybookList' },
            ],
            index: 1, // Make sure PlaybookList is active
          }},
          { name: 'PlaybookDetail', params: { playbook: aiResponse } },
        ],
      });
  } catch (_error) {
    Alert.alert('Error', 'Failed to generate playbook. Please try again.');
  } finally {
    setIsLoading(false);
  }
};

  const handleInputPress = () => {
    inputRef.current?.focus();
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <StatusBar barStyle="light-content" />
      <View style={styles.content}>
        <View style={styles.header}>
          <Image source={require('../../assets/images/siFia.png')} style={styles.logo} resizeMode="contain" />
        </View>
        <View style={styles.spacer} />
        <View style={styles.inputContainer}>
          <View style={styles.askBox}>
            <TextInput
              ref={inputRef}
              style={styles.askInput}
              placeholder={`Ask Anchored to ${placeholderText}`}
              placeholderTextColor={Colors.trustGrey}
              value={userInput}
              onChangeText={setUserInput}
              multiline
              maxLength={500}
              textAlignVertical="top"
              autoCapitalize="sentences"
              keyboardAppearance="dark"
              textBreakStrategy="simple"
              underlineColorAndroid="transparent"
              autoCorrect={true}
              autoFocus={false}
              onTouchStart={handleInputPress}
            />
            <TouchableOpacity
              style={[
                styles.askSendButton,
                (!userInput || !userInput.trim()) && styles.disabledButton,
              ]}
              onPress={handleGeneratePlaybook}
              disabled={isLoading || !userInput || !userInput.trim()}
            >
              {isLoading ? (
                <ActivityIndicator color={Colors.hopeWhite} />
              ) : (
                <Ionicons
                  name="arrow-up-circle"
                  size={34}
                  color={(!userInput || !userInput.trim()) ? 'rgba(255, 255, 255, 0.5)' : Colors.hopeWhite}
                />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
    paddingBottom: 0,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 80,
  },
  header: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 40,
    paddingTop: 180, // Adjusted top padding to better position the larger logo
    paddingBottom: 20,
  },
  logo: {
    width: '120%',
    height: 150,
    marginTop: -20,
    marginBottom: 10,
  },
  spacer: {
    flex: 1,
  },
  inputContainer: {
    paddingBottom: 24,
    marginBottom: Platform.OS === 'ios' ? 0 : 20, // Add some bottom margin on Android
  },
  askBox: {
    borderRadius: 28,
    backgroundColor: Colors.inputBackground,
    borderWidth: 1.5,
    borderColor: Colors.inputBorder,
    padding: 12,
    paddingRight: 60, // Space for send button
    width: '100%',
    minHeight: 150,
    maxHeight: 240, // Increased max height
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    flexDirection: 'column',
    position: 'relative',
    ...Platform.select({
      android: {
        paddingTop: 10,
      },
    }),
  },
  askInput: {
    color: Colors.hopeWhite,
    fontSize: 16,
    // Set consistent padding and margins
    padding: 0,
    margin: 0,
    // Set line height with some extra space
    lineHeight: 24,
    backgroundColor: 'transparent',
    width: '100%',
    textAlign: 'left',
    includeFontPadding: true, // Keep font padding for better alignment
    textAlignVertical: 'top', // Ensure text stays at the top
    // Allow text to wrap and grow
    flex: 1,
    // Platform-specific adjustments
    ...Platform.select({
      ios: {
        paddingTop: 8,
      },
      android: {
        textAlignVertical: 'top',
        paddingTop: 6,
      },
    }),
  },
  askSendButton: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    zIndex: 10,
  },
  disabledButton: {
    opacity: 0.7,
    borderRadius: 20,
    padding: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.1)', // Slight background for better visibility
  },
});

export default UserInputScreen;
