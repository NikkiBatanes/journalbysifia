/**
 * Personalized Preview Component
 * Shows users their customized journey based on assessment results
 * Demonstrates immediate value and builds excitement
 */

import React, { useState, useEffect, useCallback } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Animated,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '../../theme/colors';
import ThemedText from '../common/ThemedText';

interface UserProfile {
  spiritualMaturity: 'new' | 'growing' | 'mature';
  timeAvailability: number;
  primaryGoals: string[];
  learningStyle: 'visual' | 'audio' | 'reading' | 'interactive';
  confidenceScore: number;
}

interface ContentRecommendation {
  id: string;
  type: 'playbook' | 'prayer_guide' | 'bible_study';
  title: string;
  description: string;
  duration: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  icon: string;
  color: string;
  preview: string;
}

interface JourneyMilestone {
  week: number;
  title: string;
  description: string;
  achievements: string[];
  icon: string;
}

interface Props {
  userProfile: UserProfile;
  onContinue: () => void;
  onBack: () => void;
}

const PersonalizedPreview: React.FC<Props> = ({ userProfile, onContinue, onBack }) => {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));
  const [recommendations, setRecommendations] = useState<ContentRecommendation[]>([]);
  const [journeyMilestones, setJourneyMilestones] = useState<JourneyMilestone[]>([]);

  const generatePersonalizedContent = useCallback(() => {
    // Generate recommendations inline to avoid hoisting issues
    const { timeAvailability, primaryGoals } = userProfile;

    const allContent: ContentRecommendation[] = [
      {
        id: '1',
        type: 'bible_study',
        title: 'Morning Strength',
        description: 'Start your day with God\'s wisdom and encouragement',
        duration: `${Math.min(timeAvailability, 5)} min`,
        difficulty: 'beginner',
        icon: 'sunny',
        color: Colors.faithGold,
        preview: 'Today\'s verse: "I can do all things through Christ who strengthens me." - Philippians 4:13',
      },
      {
        id: '2',
        type: 'playbook',
        title: 'Anxiety to Peace',
        description: 'Biblical strategies for overcoming worry and anxiety',
        duration: `${Math.min(timeAvailability, 15)} min`,
        difficulty: 'intermediate',
        icon: 'heart',
        color: Colors.growthGreen,
        preview: 'Learn practical steps to find God\'s peace in anxious moments',
      },
      {
        id: '3',
        type: 'bible_study',
        title: 'Bible Foundations',
        description: 'Understanding God\'s word made simple',
        duration: `${Math.min(timeAvailability, 10)} min`,
        difficulty: 'beginner',
        icon: 'book',
        color: Colors.sage,
        preview: 'Discover the life-changing truths in Scripture with easy-to-understand explanations',
      },
    ];

    let filtered = allContent.filter(content => {
      if (primaryGoals.includes('prayer') && content.type === 'prayer_guide') {return true;}
      if (primaryGoals.includes('bible_study') && content.type === 'bible_study') {return true;}
      if (primaryGoals.includes('anxiety') && content.type === 'playbook') {return true;}
      return false;
    });

    if (filtered.length < 3) {
      filtered = allContent.slice(0, 3);
    }

    setRecommendations(filtered);

    // Generate milestones inline
    const milestones: JourneyMilestone[] = [
      {
        week: 1,
        title: 'Foundation Building',
        description: 'Establish daily spiritual habits and connect with God',
        achievements: ['Complete daily devotions', 'Start prayer journal', 'Join community group'],
        icon: 'home',
      },
      {
        week: 2,
        title: 'Growing in Faith',
        description: 'Deepen your relationship with God through study and prayer',
        achievements: ['Complete Bible study', 'Practice gratitude daily', 'Share faith story'],
        icon: 'leaf',
      },
      {
        week: 3,
        title: 'Living It Out',
        description: 'Apply biblical principles to daily life and relationships',
        achievements: ['Serve others', 'Practice forgiveness', 'Lead family devotions'],
        icon: 'people',
      },
      {
        week: 4,
        title: 'Transformation',
        description: 'Experience lasting change and spiritual growth',
        achievements: ['Mentor someone new', 'Lead a small group', 'Share your testimony'],
        icon: 'star',
      },
    ];

    setJourneyMilestones(milestones);
  }, [userProfile]);

  useEffect(() => {
    generatePersonalizedContent();
  }, [generatePersonalizedContent]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  // const generateRecommendations = (): ContentRecommendation[] => {
  //   const { timeAvailability, primaryGoals } = userProfile;

  //   const allContent: ContentRecommendation[] = [
  //     {
  //       id: 'morning_reflection',
  //       type: 'bible_study',
  //       title: 'Morning Strength',
  //       description: 'Start your day with God\'s wisdom and encouragement',
  //       duration: `${Math.min(timeAvailability, 5)} min`,
  //       difficulty: 'beginner',
  //       icon: 'sunny',
  //       color: Colors.faithGold,
  //       preview: 'Today\'s verse: "I can do all things through Christ who strengthens me." - Philippians 4:13',
  //     },
  //     {
  //       id: 'prayer_guide',
  //       type: 'prayer_guide',
  //       title: 'Prayer Journey',
  //       description: 'Guided prayers for deeper connection with God',
  //       duration: `${Math.min(timeAvailability, 7)} min`,
  //       difficulty: 'beginner',
  //       icon: 'hand-left',
  //       color: Colors.spiritualPink,
  //       preview: 'Learn to pray with confidence using the ACTS method: Adoration, Confession, Thanksgiving, Supplication',
  //     },
  //     {
  //       id: 'bible_basics',
  //       type: 'bible_study',
  //       title: 'Bible Foundations',
  //       description: 'Understanding God\'s word made simple',
  //       duration: `${Math.min(timeAvailability, 10)} min`,
  //       difficulty: 'beginner',
  //       icon: 'book',
  //       color: Colors.sage,
  //       preview: 'Discover the life-changing truths in Scripture with easy-to-understand explanations',
  //     },
  //     {
  //       id: 'character_growth',
  //       type: 'playbook',
  //       title: 'Character Development',
  //       description: 'Building Christ-like character step by step',
  //       duration: `${timeAvailability} min`,
  //       difficulty: 'intermediate',
  //       icon: 'diamond',
  //       color: Colors.growthGreen,
  //       preview: 'Week 1: Developing patience through daily challenges and biblical wisdom',
  //     },
  //     {
  //       id: 'service_opportunities',
  //       type: 'playbook',
  //       title: 'Serving Others',
  //       description: 'Practical ways to show God\'s love in action',
  //       duration: `${timeAvailability} min`,
  //       difficulty: 'intermediate',
  //       icon: 'hand-right',
  //       color: Colors.ministryPurple,
  //       preview: 'Discover your unique gifts and how to use them to bless others in your community',
  //     },
  //   ];

  //   let filtered = allContent.filter(content => {
  //     if (primaryGoals.includes('prayer') && content.type === 'prayer_guide') {return true;}
  //     if (primaryGoals.includes('bible_study') && content.type === 'bible_study') {return true;}
  //     if (primaryGoals.includes('character') && content.id === 'character_growth') {return true;}
  //     if (primaryGoals.includes('service') && content.id === 'service_opportunities') {return true;}
  //     if (content.type === 'bible_study') {return true;} // Always include Bible study content
  //     return false;
  //   });

  //   if (filtered.length < 3) {
  //     filtered = allContent.slice(0, 3);
  //   }

  //   return filtered.slice(0, 4); // Max 4 recommendations
  // };

  // const generateJourneyMilestones = (): JourneyMilestone[] => {
  //   const { primaryGoals } = userProfile;

  //   const baseAchievements = [
  //     'Complete daily devotions',
  //     'Build consistent prayer habits',
  //     'Understand key Bible concepts',
  //   ];

  //   const goalAchievements: Record<string, string[]> = {
  //     'prayer': ['Master different prayer types', 'Experience answered prayers'],
  //     'bible_study': ['Read through a Gospel', 'Memorize key verses'],
  //     'character': ['Develop patience and kindness', 'Practice forgiveness'],
  //     'service': ['Find your ministry calling', 'Serve in your community'],
  //     'relationships': ['Build godly friendships', 'Strengthen family bonds'],
  //     playbooks: [
  //       { title: 'Overcoming Worry & Anxiety', steps: 7, relevance: 96, description: 'Biblical strategies for peace' },
  //       { title: 'Building Strong Prayer Life', steps: 5, relevance: 92, description: 'Develop consistent prayer habits' },
  //       { title: 'Financial Stewardship', steps: 9, relevance: 88, description: 'Manage money God\'s way' },
  //       { title: 'Strengthening Marriage', steps: 8, relevance: 85, description: 'Biblical relationship principles' },
  //     ],
  //     studies: [
  //       { title: 'Psalms for Anxiety', chapters: 12, relevance: 92 },
  //       { title: 'Proverbs for Wisdom', chapters: 8, relevance: 85 },
  //       { title: 'Romans: Grace & Growth', chapters: 16, relevance: 80 },
  //     ],
  //     journaling: [
  //       { title: 'Gratitude & Growth', prompts: 30, relevance: 90 },
  //       { title: 'Prayer Reflections', prompts: 25, relevance: 87 },
  //       { title: 'Scripture Meditation', prompts: 20, relevance: 84 },
  //     ],
  //   };
  // };

  const getPersonalizedGreeting = (): string => {
    const { spiritualMaturity, timeAvailability } = userProfile;

    if (spiritualMaturity === 'new') {
      return `Perfect! We've created a gentle ${timeAvailability}-minute daily journey just for you.`;
    } else if (spiritualMaturity === 'growing') {
      return `Excellent! Your ${timeAvailability}-minute daily growth plan is ready to take you deeper.`;
    } else {
      return `Wonderful! Your ${timeAvailability}-minute leadership development journey awaits.`;
    }
  };

  const renderRecommendationCard = (rec: ContentRecommendation, _index: number) => (
    <Animated.View
      key={rec.id}
      style={[
        styles.recommendationCard,
        {
          transform: [{
            translateY: slideAnim.interpolate({
              inputRange: [0, 50],
              outputRange: [0, 50],
              extrapolate: 'clamp',
            }),
          }],
          opacity: fadeAnim,
        },
      ]}
    >
      <View style={[styles.cardHeader, { backgroundColor: rec.color }]}>
        <View style={styles.cardIcon}>
          <Ionicons name={rec.icon as any} size={24} color="white" />
        </View>
        <View style={styles.cardHeaderText}>
          <Text style={styles.cardTitle}>{rec.title}</Text>
          <Text style={styles.cardDuration}>{rec.duration}</Text>
        </View>
        <View style={styles.difficultyBadge}>
          <Text style={styles.difficultyText}>
            {rec.difficulty.charAt(0).toUpperCase() + rec.difficulty.slice(1)}
          </Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.cardDescription}>{rec.description}</Text>
        <View style={styles.previewContainer}>
          <Text style={styles.previewLabel}>Preview:</Text>
          <Text style={styles.previewText}>{rec.preview}</Text>
        </View>
      </View>
    </Animated.View>
  );

  const renderMilestone = (milestone: JourneyMilestone, _index: number) => (
    <View key={milestone.week} style={styles.milestoneContainer}>
      <View style={styles.milestoneHeader}>
        <View style={styles.milestoneIcon}>
          <Ionicons name={milestone.icon as any} size={20} color={Colors.sage} />
        </View>
        <View style={styles.milestoneHeaderText}>
          <Text style={styles.milestoneWeek}>Week {milestone.week}</Text>
          <Text style={styles.milestoneTitle}>{milestone.title}</Text>
        </View>
      </View>

      <Text style={styles.milestoneDescription}>{milestone.description}</Text>

      <View style={styles.achievementsContainer}>
        {milestone.achievements.map((achievement, idx) => (
          <View key={idx} style={styles.achievementItem}>
            <Ionicons name="checkmark-circle" size={16} color={Colors.growthGreen} />
            <Text style={styles.achievementText}>{achievement}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  // const content = getPersonalizedContent();

  return (
  <SafeAreaView style={styles.container}>
    {/* Header */}
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.backButton}>
        <Ionicons name="chevron-back" size={24} color={Colors.sage} />
      </TouchableOpacity>
      <ThemedText weight="bold" style={styles.headerTitle}>Your Journey</ThemedText>
    </View>

    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      {/* Personalized Greeting */}
      <Animated.View style={[styles.greetingSection, { opacity: fadeAnim }]}>
        <View style={styles.greetingIcon}>
          <Ionicons name="sparkles" size={32} color={Colors.faithGold} />
        </View>
        <ThemedText weight="bold" style={styles.greetingTitle}>Your Personalized Journey</ThemedText>
        <ThemedText style={styles.greetingText}>{getPersonalizedGreeting()}</ThemedText>
      </Animated.View>

      {/* Content Recommendations */}
      <View style={styles.section}>
        <ThemedText weight="bold" style={styles.sectionTitle}>Recommended for You</ThemedText>
        <ThemedText style={styles.sectionSubtitle}>
          Based on your goals and available time
        </ThemedText>

        {recommendations.map((rec, index) => renderRecommendationCard(rec, index))}
      </View>

      {/* Journey Milestones */}
      <View style={styles.section}>
        <ThemedText weight="bold" style={styles.sectionTitle}>Your 4-Week Journey</ThemedText>
        <ThemedText style={styles.sectionSubtitle}>
          Here's what you can expect to achieve
        </ThemedText>

        {journeyMilestones.map((milestone, index) => renderMilestone(milestone, index))}
      </View>

      {/* Call to Action */}
      <Animated.View style={[styles.ctaSection, { opacity: fadeAnim }]}>
        <ThemedText weight="bold" style={styles.ctaTitle}>Ready to Begin?</ThemedText>
        <ThemedText style={styles.ctaText}>
          Your personalized spiritual growth journey starts with just one tap.
        </ThemedText>

        <TouchableOpacity style={styles.startButton} onPress={onContinue}>
          <ThemedText weight="bold" style={styles.startButtonText}>Start My Journey</ThemedText>
          <Ionicons name="arrow-forward" size={20} color="white" />
        </TouchableOpacity>
      </Animated.View>
    </ScrollView>
  </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.hopeWhite,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    padding: 8,
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.darkerGray,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  greetingSection: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  greetingIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: `${Colors.faithGold}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  greetingTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.darkerGray,
    marginBottom: 8,
    textAlign: 'center',
  },
  greetingText: {
    fontSize: 16,
    color: Colors.textGray,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.darkerGray,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: Colors.textGray,
    marginBottom: 20,
  },
  recommendationCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#29342E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
    marginBottom: 2,
  },
  cardDuration: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  difficultyBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  difficultyText: {
    fontSize: 12,
    color: Colors.hopeWhite,
    fontWeight: '500',
  },
  cardBody: {
    padding: 16,
  },
  cardDescription: {
    fontSize: 16,
    color: Colors.darkerGray,
    lineHeight: 22,
    marginBottom: 12,
  },
  previewContainer: {
    backgroundColor: Colors.lightGray,
    padding: 12,
    borderRadius: 8,
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textGray,
    marginBottom: 4,
  },
  previewText: {
    fontSize: 14,
    color: Colors.darkerGray,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  milestoneContainer: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: Colors.sage,
  },
  milestoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  milestoneIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: `${Colors.sage}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  milestoneHeaderText: {
    flex: 1,
  },
  milestoneWeek: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.sage,
    marginBottom: 2,
  },
  milestoneTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.darkerGray,
  },
  milestoneDescription: {
    fontSize: 14,
    color: Colors.textGray,
    lineHeight: 20,
    marginBottom: 12,
  },
  achievementsContainer: {
    marginTop: 8,
  },
  achievementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  achievementText: {
    fontSize: 14,
    color: Colors.darkerGray,
    marginLeft: 8,
    flex: 1,
  },
  ctaSection: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingBottom: 48,
  },
  ctaTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.darkerGray,
    marginBottom: 8,
    textAlign: 'center',
  },
  ctaText: {
    fontSize: 16,
    color: Colors.textGray,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.sage,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 25,
    shadowColor: '#29342E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  startButtonText: {
    color: Colors.hopeWhite,
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8,
  },
});

export default PersonalizedPreview;
