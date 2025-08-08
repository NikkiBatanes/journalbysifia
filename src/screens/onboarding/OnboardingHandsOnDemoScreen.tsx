import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  StatusBar,
  TextInput,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useUserState } from '../../hooks/useUserState';
import OnboardingProgressIndicator from '../../components/OnboardingProgressIndicator';
import { Colors } from '../../theme/colors';

const { width, height } = Dimensions.get('window');

interface DemoStep {
  id: string;
  title: string;
  description: string;
  component: 'ai_chat' | 'prayer_journal' | 'scripture_study' | 'progress_tracker';
  completed: boolean;
}

const OnboardingHandsOnDemoScreen: React.FC = () => {
  const navigation = useNavigation();
  const { updateOnboardingStep } = useUserState();
  const [currentDemo, setCurrentDemo] = useState<string>('ai_chat');
  const [demoSteps, setDemoSteps] = useState<DemoStep[]>([
    {
      id: 'ai_chat',
      title: 'AI Spiritual Guidance',
      description: 'Ask a question and see personalized guidance',
      component: 'ai_chat',
      completed: false,
    },
    {
      id: 'prayer_journal',
      title: 'Prayer Journal',
      description: 'Add a prayer request and track it',
      component: 'prayer_journal',
      completed: false,
    },
    {
      id: 'scripture_study',
      title: 'Scripture Study',
      description: 'Explore interactive Bible study',
      component: 'scripture_study',
      completed: false,
    },
    {
      id: 'progress_tracker',
      title: 'Spiritual Growth',
      description: 'See your faith journey progress',
      component: 'progress_tracker',
      completed: false,
    },
  ]);

  const [userQuestion, setUserQuestion] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [prayerText, setPrayerText] = useState('');
  const [showAiResponse, setShowAiResponse] = useState(false);
  const [showPrayerAdded, setShowPrayerAdded] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const markStepCompleted = (stepId: string) => {
    setDemoSteps(prev => 
      prev.map(step => 
        step.id === stepId ? { ...step, completed: true } : step
      )
    );
  };

  const handleAskQuestion = () => {
    if (!userQuestion.trim()) return;
    
    setShowAiResponse(true);
    setAiResponse(`Based on your question about "${userQuestion}", here's some personalized guidance: Remember that faith is a journey of trust. Consider reflecting on Proverbs 3:5-6 - "Trust in the Lord with all your heart and lean not on your own understanding." Take time today to pray about this concern and listen for God's guidance.`);
    markStepCompleted('ai_chat');
  };

  const handleAddPrayer = () => {
    if (!prayerText.trim()) return;
    
    setShowPrayerAdded(true);
    markStepCompleted('prayer_journal');
  };

  const handleContinue = async () => {
    await updateOnboardingStep(7);
    navigation.navigate('OnboardingPricingShowcase' as never);
  };

  const renderAiChatDemo = () => (
    <View style={styles.demoContainer}>
      <Text style={styles.demoTitle}>Try AI Spiritual Guidance</Text>
      <Text style={styles.demoSubtitle}>Ask any question about faith, relationships, or life challenges</Text>
      
      <View style={styles.chatContainer}>
        <TextInput
          style={styles.questionInput}
          placeholder="Ask your question here..."
          value={userQuestion}
          onChangeText={setUserQuestion}
          multiline
          maxLength={200}
        />
        <TouchableOpacity 
          style={[styles.askButton, !userQuestion.trim() && styles.disabledButton]}
          onPress={handleAskQuestion}
          disabled={!userQuestion.trim()}
        >
          <Text style={styles.askButtonText}>Get AI Guidance</Text>
          <Ionicons name="send" size={16} color={Colors.hopeWhite} />
        </TouchableOpacity>
      </View>

      {showAiResponse && (
        <Animated.View style={[styles.responseContainer, { opacity: fadeAnim }]}>
          <View style={styles.aiResponseHeader}>
            <Ionicons name="bulb" size={20} color={Colors.anchorBlue} />
            <Text style={styles.aiResponseTitle}>Personalized Guidance</Text>
          </View>
          <Text style={styles.aiResponseText}>{aiResponse}</Text>
          <View style={styles.completedBadge}>
            <Ionicons name="checkmark-circle" size={16} color={Colors.successGreen} />
            <Text style={styles.completedText}>Demo Completed!</Text>
          </View>
        </Animated.View>
      )}
    </View>
  );

  const renderPrayerJournalDemo = () => (
    <View style={styles.demoContainer}>
      <Text style={styles.demoTitle}>Try Prayer Journal</Text>
      <Text style={styles.demoSubtitle}>Add a prayer request and see how we help you track God's answers</Text>
      
      <View style={styles.prayerContainer}>
        <TextInput
          style={styles.prayerInput}
          placeholder="Share your prayer request..."
          value={prayerText}
          onChangeText={setPrayerText}
          multiline
          maxLength={300}
        />
        <TouchableOpacity 
          style={[styles.prayerButton, !prayerText.trim() && styles.disabledButton]}
          onPress={handleAddPrayer}
          disabled={!prayerText.trim()}
        >
          <Text style={styles.prayerButtonText}>Add to Prayer Journal</Text>
          <Ionicons name="heart" size={16} color={Colors.hopeWhite} />
        </TouchableOpacity>
      </View>

      {showPrayerAdded && (
        <Animated.View style={[styles.responseContainer, { opacity: fadeAnim }]}>
          <View style={styles.prayerAddedHeader}>
            <Ionicons name="heart" size={20} color={Colors.anchorBlue} />
            <Text style={styles.prayerAddedTitle}>Prayer Added Successfully</Text>
          </View>
          <Text style={styles.prayerAddedText}>
            Your prayer has been added to your journal. We'll help you track how God answers this prayer over time, and provide relevant scripture and encouragement.
          </Text>
          <View style={styles.completedBadge}>
            <Ionicons name="checkmark-circle" size={16} color={Colors.successGreen} />
            <Text style={styles.completedText}>Demo Completed!</Text>
          </View>
        </Animated.View>
      )}
    </View>
  );

  const renderScriptureStudyDemo = () => (
    <View style={styles.demoContainer}>
      <Text style={styles.demoTitle}>Interactive Scripture Study</Text>
      <Text style={styles.demoSubtitle}>Experience personalized Bible study with AI insights</Text>
      
      <View style={styles.scriptureContainer}>
        <View style={styles.verseCard}>
          <Text style={styles.verseReference}>Philippians 4:13</Text>
          <Text style={styles.verseText}>
            "I can do all things through Christ who strengthens me."
          </Text>
        </View>
        
        <TouchableOpacity 
          style={styles.studyButton}
          onPress={() => markStepCompleted('scripture_study')}
        >
          <Text style={styles.studyButtonText}>Explore This Verse</Text>
          <Ionicons name="book" size={16} color={Colors.hopeWhite} />
        </TouchableOpacity>

        <View style={styles.insightCard}>
          <Text style={styles.insightTitle}>AI Insight</Text>
          <Text style={styles.insightText}>
            This verse reminds us that our strength comes from Christ. Consider how this applies to your current challenges and what "all things" might mean in your context.
          </Text>
        </View>
      </View>
    </View>
  );

  const renderProgressTrackerDemo = () => (
    <View style={styles.demoContainer}>
      <Text style={styles.demoTitle}>Track Your Spiritual Growth</Text>
      <Text style={styles.demoSubtitle}>See how your faith journey progresses over time</Text>
      
      <View style={styles.progressContainer}>
        <View style={styles.progressCard}>
          <Text style={styles.progressCardTitle}>This Week's Progress</Text>
          <View style={styles.progressItem}>
            <Text style={styles.progressLabel}>Daily Devotions</Text>
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBar, { width: '85%' }]} />
            </View>
            <Text style={styles.progressValue}>6/7 days</Text>
          </View>
          <View style={styles.progressItem}>
            <Text style={styles.progressLabel}>Prayer Time</Text>
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBar, { width: '70%' }]} />
            </View>
            <Text style={styles.progressValue}>5/7 days</Text>
          </View>
        </View>
        
        <TouchableOpacity 
          style={styles.viewProgressButton}
          onPress={() => markStepCompleted('progress_tracker')}
        >
          <Text style={styles.viewProgressButtonText}>View Full Progress</Text>
          <Ionicons name="trending-up" size={16} color={Colors.hopeWhite} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderDemoContent = () => {
    switch (currentDemo) {
      case 'ai_chat':
        return renderAiChatDemo();
      case 'prayer_journal':
        return renderPrayerJournalDemo();
      case 'scripture_study':
        return renderScriptureStudyDemo();
      case 'progress_tracker':
        return renderProgressTrackerDemo();
      default:
        return renderAiChatDemo();
    }
  };

  const completedCount = demoSteps.filter(step => step.completed).length;
  const canContinue = completedCount >= 2;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.hopeWhite} />
      
      <OnboardingProgressIndicator currentStep={6} totalSteps={7} />
      
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Experience siFia Hands-On</Text>
            <Text style={styles.subtitle}>
              Try these features to see how siFia transforms your daily spiritual practice
            </Text>
          </View>

          <View style={styles.tabContainer}>
            {demoSteps.map((step) => (
              <TouchableOpacity
                key={step.id}
                style={[
                  styles.tab,
                  currentDemo === step.id && styles.activeTab,
                  step.completed && styles.completedTab,
                ]}
                onPress={() => setCurrentDemo(step.id)}
              >
                <Text style={[
                  styles.tabText,
                  currentDemo === step.id && styles.activeTabText,
                  step.completed && styles.completedTabText,
                ]}>
                  {step.title}
                </Text>
                {step.completed && (
                  <Ionicons name="checkmark-circle" size={16} color={Colors.successGreen} />
                )}
              </TouchableOpacity>
            ))}
          </View>

          {renderDemoContent()}

          <View style={styles.progressSection}>
            <Text style={styles.progressText}>
              {completedCount} of {demoSteps.length} demos completed
            </Text>
          </View>
        </Animated.View>
      </ScrollView>

      {canContinue && (
        <View style={styles.footer}>
          <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
            <Text style={styles.continueButtonText}>Continue to Pricing</Text>
            <Ionicons name="arrow-forward" size={20} color={Colors.hopeWhite} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.hopeWhite,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  header: {
    marginBottom: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.anchorBlue,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  tabContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: Colors.borderLight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  activeTab: {
    backgroundColor: Colors.anchorBlue,
  },
  completedTab: {
    backgroundColor: Colors.lightGreen,
  },
  tabText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  activeTabText: {
    color: Colors.hopeWhite,
  },
  completedTabText: {
    color: Colors.successGreen,
  },
  demoContainer: {
    marginBottom: 24,
  },
  demoTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.anchorBlue,
    marginBottom: 8,
  },
  demoSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 16,
  },
  chatContainer: {
    gap: 12,
  },
  questionInput: {
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  askButton: {
    backgroundColor: Colors.anchorBlue,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  disabledButton: {
    backgroundColor: Colors.borderLight,
  },
  askButtonText: {
    color: Colors.hopeWhite,
    fontSize: 16,
    fontWeight: '600',
  },
  responseContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: Colors.lightBlue,
    borderRadius: 12,
  },
  aiResponseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  aiResponseTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.anchorBlue,
  },
  aiResponseText: {
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 20,
    marginBottom: 12,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  completedText: {
    fontSize: 12,
    color: Colors.successGreen,
    fontWeight: '500',
  },
  prayerContainer: {
    gap: 12,
  },
  prayerInput: {
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  prayerButton: {
    backgroundColor: Colors.anchorBlue,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  prayerButtonText: {
    color: Colors.hopeWhite,
    fontSize: 16,
    fontWeight: '600',
  },
  prayerAddedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  prayerAddedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.anchorBlue,
  },
  prayerAddedText: {
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 20,
    marginBottom: 12,
  },
  scriptureContainer: {
    gap: 16,
  },
  verseCard: {
    padding: 20,
    backgroundColor: Colors.lightBlue,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: Colors.anchorBlue,
  },
  verseReference: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.anchorBlue,
    marginBottom: 8,
  },
  verseText: {
    fontSize: 16,
    color: Colors.textPrimary,
    fontStyle: 'italic',
    lineHeight: 24,
  },
  studyButton: {
    backgroundColor: Colors.anchorBlue,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  studyButtonText: {
    color: Colors.hopeWhite,
    fontSize: 16,
    fontWeight: '600',
  },
  insightCard: {
    padding: 16,
    backgroundColor: Colors.lightGreen,
    borderRadius: 12,
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.successGreen,
    marginBottom: 8,
  },
  insightText: {
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  progressContainer: {
    gap: 16,
  },
  progressCard: {
    padding: 20,
    backgroundColor: Colors.lightBlue,
    borderRadius: 12,
  },
  progressCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.anchorBlue,
    marginBottom: 16,
  },
  progressItem: {
    marginBottom: 12,
  },
  progressLabel: {
    fontSize: 14,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: Colors.borderLight,
    borderRadius: 3,
    marginBottom: 4,
  },
  progressBar: {
    height: '100%',
    backgroundColor: Colors.anchorBlue,
    borderRadius: 3,
  },
  progressValue: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  viewProgressButton: {
    backgroundColor: Colors.anchorBlue,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  viewProgressButtonText: {
    color: Colors.hopeWhite,
    fontSize: 16,
    fontWeight: '600',
  },
  progressSection: {
    marginTop: 24,
    marginBottom: 24,
  },
  progressText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  footer: {
    padding: 24,
    paddingBottom: 40,
  },
  continueButton: {
    backgroundColor: Colors.anchorBlue,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: Colors.anchorBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  continueButtonText: {
    color: Colors.hopeWhite,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default OnboardingHandsOnDemoScreen;
